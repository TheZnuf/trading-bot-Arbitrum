const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { ethers } = require('ethers');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ==================== CONFIGURATION ====================
let CONFIG = {
  RPC_URL: process.env.ARBITRUM_RPC_URL || '',
  PRIVATE_KEY: process.env.PRIVATE_KEY || '',
  DROP_PERCENTAGE: 2,
  CHECK_INTERVAL: 60000,
  SLIPPAGE_TOLERANCE: 1,
  
  UNISWAP_ROUTER: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  QUOTER: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
};

let PAIRS = [
  {
    id: 1,
    name: 'WBTC',
    address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    decimals: 8,
    purchaseAmount: '1000',
    maxPurchases: 10,
    dropPercentage: 2,
    fee: 3000,
    enabled: true
  },
  {
    id: 2,
    name: 'WETH',
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    decimals: 18,
    purchaseAmount: '500',
    maxPurchases: 15,
    dropPercentage: 2,
    fee: 500,
    enabled: true
  },
  {
    id: 3,
    name: 'LINK',
    address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    decimals: 18,
    purchaseAmount: '300',
    maxPurchases: 20,
    dropPercentage: 2,
    fee: 3000,
    enabled: true
  },
  {
    id: 4,
    name: 'AVAX',
    address: '0x565609fAF65B92F7be02468acF86f8979423e514',
    decimals: 18,
    purchaseAmount: '400',
    maxPurchases: 12,
    dropPercentage: 2,
    fee: 3000,
    enabled: true
  },
  {
    id: 5,
    name: 'SOL',
    address: '0xb74Da9FE2F96B9E0a5f4A3cf0b92dd2bEC617124',
    decimals: 9,
    purchaseAmount: '600',
    maxPurchases: 10,
    dropPercentage: 2,
    fee: 10000,
    enabled: true
  },
  {
    id: 6,
    name: 'LDO',
    address: '0x13Ad51ed4F1B7e9Dc168d8a00cB3f4dDD85EfA60',
    decimals: 18,
    purchaseAmount: '250',
    maxPurchases: 15,
    dropPercentage: 2,
    fee: 3000,
    enabled: true
  }
];

// ABIs
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)'
];

const QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
];

const ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
];

// ==================== PAIR TRACKER ====================
class PairTracker {
  constructor(config, contracts, emitLog) {
    this.config = config;
    this.contracts = contracts;
    this.emitLog = emitLog;
    this.lastPurchasePrice = null;
    this.ath = null; // ATH depuis le dernier achat
    this.purchaseCount = 0;
    this.currentPrice = null;
    this.balance = '0';
  }

  async getCurrentPrice() {
    try {
      const amountIn = ethers.parseUnits(this.config.purchaseAmount, 6);
      
      const params = {
        tokenIn: CONFIG.USDC,
        tokenOut: this.config.address,
        amountIn: amountIn,
        fee: this.config.fee,
        sqrtPriceLimitX96: 0
      };
      
      const quote = await this.contracts.quoter.quoteExactInputSingle.staticCall(params);
      const tokenOut = quote[0];
      
      const pricePerToken = parseFloat(this.config.purchaseAmount) / 
                           parseFloat(ethers.formatUnits(tokenOut, this.config.decimals));
      
      this.currentPrice = pricePerToken;
      return pricePerToken;
    } catch (error) {
      this.emitLog('error', `[${this.config.name}] Erreur prix: ${error.message}`);
      return null;
    }
  }

  async getBalance() {
    try {
      const tokenContract = new ethers.Contract(this.config.address, ERC20_ABI, this.contracts.wallet);
      const balance = await tokenContract.balanceOf(this.contracts.wallet.address);
      this.balance = ethers.formatUnits(balance, this.config.decimals);
      return this.balance;
    } catch (error) {
      return '0';
    }
  }

  async executePurchase() {
    try {
      this.emitLog('info', `[${this.config.name}] 🔄 Exécution de l'achat...`);
      
      const amountIn = ethers.parseUnits(this.config.purchaseAmount, 6);
      
      const allowance = await this.contracts.usdc.allowance(
        this.contracts.wallet.address, 
        CONFIG.UNISWAP_ROUTER
      );
      
      if (allowance < amountIn) {
        this.emitLog('info', `[${this.config.name}] 📝 Approbation USDC...`);
        const approveTx = await this.contracts.usdc.approve(CONFIG.UNISWAP_ROUTER, ethers.MaxUint256);
        await approveTx.wait();
        this.emitLog('success', `[${this.config.name}] ✅ Approbation confirmée`);
      }
      
      const quote = await this.contracts.quoter.quoteExactInputSingle.staticCall({
        tokenIn: CONFIG.USDC,
        tokenOut: this.config.address,
        amountIn: amountIn,
        fee: this.config.fee,
        sqrtPriceLimitX96: 0
      });
      
      const amountOutMin = (quote[0] * BigInt(100 - CONFIG.SLIPPAGE_TOLERANCE)) / BigInt(100);
      
      const swapParams = {
        tokenIn: CONFIG.USDC,
        tokenOut: this.config.address,
        fee: this.config.fee,
        recipient: this.contracts.wallet.address,
        amountIn: amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0
      };
      
      const tx = await this.contracts.router.exactInputSingle(swapParams);
      this.emitLog('info', `[${this.config.name}] ⏳ TX: ${tx.hash}`);
      
      await tx.wait();
      this.emitLog('success', `[${this.config.name}] ✅ Achat confirmé!`);
      
      this.purchaseCount++;
      this.lastPurchasePrice = await this.getCurrentPrice();
      await this.getBalance();
      
      this.emitLog('success', 
        `[${this.config.name}] 📊 Achat #${this.purchaseCount} - Prix: ${this.lastPurchasePrice.toFixed(4)} USDC - Balance: ${this.balance}`
      );
      
      return true;
    } catch (error) {
      this.emitLog('error', `[${this.config.name}] ❌ Erreur achat: ${error.message}`);
      return false;
    }
  }

  shouldPurchase() {
    return this.purchaseCount < this.config.maxPurchases;
  }

  async checkAndExecute() {
    if (!this.shouldPurchase()) {
      return;
    }
    
    const currentPrice = await this.getCurrentPrice();
    if (!currentPrice) return;
    
    if (this.lastPurchasePrice === null) {
      this.emitLog('info', `[${this.config.name}] 🎯 Premier achat déclenché`);
      await this.executePurchase();
      return;
    }
    
    const priceChange = ((currentPrice - this.lastPurchasePrice) / this.lastPurchasePrice) * 100;
    
    // Utiliser le dropPercentage de la paire
    const dropThreshold = this.config.dropPercentage || CONFIG.DROP_PERCENTAGE;
    
    if (priceChange <= -dropThreshold) {
      this.emitLog('success', `[${this.config.name}] 🎯 Déclenchement! Baisse de ${Math.abs(priceChange).toFixed(2)}%`);
      await this.executePurchase();
    }
  }

  getState() {
    return {
      id: this.config.id,
      name: this.config.name,
      currentPrice: this.currentPrice,
      lastPurchasePrice: this.lastPurchasePrice,
      purchaseCount: this.purchaseCount,
      balance: this.balance,
      dropPercentage: this.config.dropPercentage,
      priceChange: this.lastPurchasePrice && this.currentPrice 
        ? ((this.currentPrice - this.lastPurchasePrice) / this.lastPurchasePrice) * 100 
        : 0
    };
  }
}

// ==================== BOT MANAGER ====================
class BotManager {
  constructor() {
    this.isRunning = false;
    this.provider = null;
    this.wallet = null;
    this.contracts = null;
    this.pairs = [];
    this.intervalId = null;
  }

  emitLog(type, message) {
    const log = {
      time: new Date().toLocaleTimeString(),
      type,
      message
    };
    io.emit('log', log);
  }

  async init() {
    try {
      if (!CONFIG.RPC_URL || !CONFIG.PRIVATE_KEY) {
        throw new Error('Configuration RPC_URL ou PRIVATE_KEY manquante');
      }

      this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      this.wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, this.provider);
      
      this.contracts = {
        wallet: this.wallet,
        usdc: new ethers.Contract(CONFIG.USDC, ERC20_ABI, this.wallet),
        quoter: new ethers.Contract(CONFIG.QUOTER, QUOTER_ABI, this.provider),
        router: new ethers.Contract(CONFIG.UNISWAP_ROUTER, ROUTER_ABI, this.wallet)
      };

      this.emitLog('success', `✅ Connexion établie: ${this.wallet.address.slice(0, 6)}...${this.wallet.address.slice(-4)}`);
      
      const usdcBalance = await this.contracts.usdc.balanceOf(this.wallet.address);
      const usdcFormatted = ethers.formatUnits(usdcBalance, 6);
      this.emitLog('info', `💰 Balance USDC: ${usdcFormatted}`);

      this.pairs = [];
      for (const pairConfig of PAIRS) {
        if (!pairConfig.enabled) continue;
        const tracker = new PairTracker(pairConfig, this.contracts, this.emitLog.bind(this));
        await tracker.getBalance();
        this.pairs.push(tracker);
      }

      this.emitLog('success', `🚀 Bot initialisé avec ${this.pairs.length} paires actives`);
      return true;
    } catch (error) {
      this.emitLog('error', `❌ Erreur d'initialisation: ${error.message}`);
      return false;
    }
  }

  async start() {
    if (this.isRunning) {
      this.emitLog('error', '⚠️ Le bot est déjà en cours d\'exécution');
      return false;
    }

    const initialized = await this.init();
    if (!initialized) return false;

    this.isRunning = true;
    this.emitLog('success', '▶️ Bot démarré!');
    
    this.intervalId = setInterval(async () => {
      await this.checkAllPairs();
    }, CONFIG.CHECK_INTERVAL);
    
    await this.checkAllPairs();
    return true;
  }

  async checkAllPairs() {
    this.emitLog('info', '🔄 Vérification des prix...');
    
    for (const pair of this.pairs) {
      await pair.checkAndExecute();
    }

    io.emit('pairs-update', this.getPairsState());

    const allComplete = this.pairs.every(p => !p.shouldPurchase());
    if (allComplete) {
      this.emitLog('info', '⛔ Toutes les paires ont atteint leur limite');
      this.stop();
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.emitLog('info', '⏸️ Bot arrêté');
  }

  getPairsState() {
    return this.pairs.map(p => p.getState());
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      walletAddress: this.wallet ? this.wallet.address : null,
      activePairs: this.pairs.length
    };
  }
}

const botManager = new BotManager();

// ==================== API ROUTES ====================

// Get current configuration
app.get('/api/config', (req, res) => {
  res.json({
    globalSettings: {
      dropPercentage: CONFIG.DROP_PERCENTAGE,
      checkInterval: CONFIG.CHECK_INTERVAL / 1000,
      slippageTolerance: CONFIG.SLIPPAGE_TOLERANCE,
      rpcUrl: CONFIG.RPC_URL ? '***configured***' : '',
      privateKey: CONFIG.PRIVATE_KEY ? '***configured***' : ''
    },
    pairs: PAIRS
  });
});

// Update configuration
app.post('/api/config', (req, res) => {
  const { globalSettings, pairs } = req.body;
  
  if (botManager.isRunning) {
    return res.status(400).json({ error: 'Cannot update config while bot is running' });
  }

  if (globalSettings) {
    if (globalSettings.dropPercentage) CONFIG.DROP_PERCENTAGE = globalSettings.dropPercentage;
    if (globalSettings.checkInterval) CONFIG.CHECK_INTERVAL = globalSettings.checkInterval * 1000;
    if (globalSettings.slippageTolerance) CONFIG.SLIPPAGE_TOLERANCE = globalSettings.slippageTolerance;
    if (globalSettings.rpcUrl) CONFIG.RPC_URL = globalSettings.rpcUrl;
    if (globalSettings.privateKey) CONFIG.PRIVATE_KEY = globalSettings.privateKey;
  }

  if (pairs) {
    PAIRS = pairs.map((p, index) => ({
      ...PAIRS[index],
      ...p
    }));
  }

  res.json({ success: true });
});

// Start bot
app.post('/api/start', async (req, res) => {
  const success = await botManager.start();
  res.json({ success });
});

// Stop bot
app.post('/api/stop', (req, res) => {
  botManager.stop();
  res.json({ success: true });
});

// Get status
app.get('/api/status', (req, res) => {
  res.json(botManager.getStatus());
});

// Get pairs state
app.get('/api/pairs', (req, res) => {
  res.json(botManager.getPairsState());
});

// ==================== WEBSOCKET ====================
io.on('connection', (socket) => {
  console.log('Client connecté');
  
  socket.emit('status', botManager.getStatus());
  socket.emit('pairs-update', botManager.getPairsState());

  socket.on('disconnect', () => {
    console.log('Client déconnecté');
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📡 WebSocket disponible sur ws://localhost:${PORT}`);
});
