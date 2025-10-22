const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { ethers } = require('ethers');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Fichier de sauvegarde de l'état
const STATE_FILE = path.join(__dirname, 'bot-state.json');

// ==================== STATE MANAGEMENT ====================
function saveState(pairs) {
  try {
    const state = {
      timestamp: new Date().toISOString(),
      pairs: pairs.map(p => ({
        id: p.config.id,
        name: p.config.name,
        lastPurchasePrice: p.lastPurchasePrice,
        ath: p.ath,
        purchaseCount: p.purchaseCount,
        totalSpent: p.totalSpent,
        averagePrice: p.averagePrice
      }))
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log('💾 État sauvegardé');
  } catch (error) {
    console.error('❌ Erreur sauvegarde état:', error.message);
  }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const state = JSON.parse(data);
      console.log('📂 État chargé depuis:', state.timestamp);
      return state.pairs;
    }
  } catch (error) {
    console.error('❌ Erreur chargement état:', error.message);
  }
  return null;
}

// ==================== CONFIGURATION ====================
let CONFIG = {
  RPC_URL: process.env.ARBITRUM_RPC_URL || '',
  PRIVATE_KEY: process.env.PRIVATE_KEY || '',
  DROP_PERCENTAGE: 2,
  CHECK_INTERVAL: 60000,
  SLIPPAGE_TOLERANCE: 1,
  
  // Montants par catégorie depuis .env
  AMOUNT_1: process.env.AMOUNT_1 || '1000', // BTC, ETH (large caps)
  AMOUNT_2: process.env.AMOUNT_2 || '500',  // Autres tokens
  
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
    purchaseAmount: CONFIG.AMOUNT_1,
    maxPurchases: 10,
    dropPercentage: 2,
    fee: 3000,
    enabled: true,
    category: 1
  },
  {
    id: 2,
    name: 'WETH',
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    decimals: 18,
    purchaseAmount: CONFIG.AMOUNT_1,
    maxPurchases: 15,
    dropPercentage: 2,
    fee: 500,
    enabled: true,
    category: 1
  },
  {
    id: 3,
    name: 'LINK',
    address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    decimals: 18,
    purchaseAmount: CONFIG.AMOUNT_2,
    maxPurchases: 20,
    dropPercentage: 2,
    fee: 3000,
    enabled: true,
    category: 2
  },
  {
    id: 4,
    name: 'AAVE',
    address: '0xba5DdD1f9d7F570dc94a51479a000E3BCE967196',
    decimals: 18,
    purchaseAmount: CONFIG.AMOUNT_2,
    maxPurchases: 12,
    dropPercentage: 2,
    fee: 3000,
    enabled: true,
    category: 2
  },
  {
    id: 5,
    name: 'UNI',
    address: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
    decimals: 18,
    purchaseAmount: CONFIG.AMOUNT_2,
    maxPurchases: 10,
    dropPercentage: 2,
    fee: 3000,
    enabled: true,
    category: 2
  },
  {
    id: 6,
    name: 'LDO',
    address: '0x13Ad51ed4F1B7e9Dc168d8a00cB3f4dDD85EfA60',
    decimals: 18,
    purchaseAmount: CONFIG.AMOUNT_2,
    maxPurchases: 15,
    dropPercentage: 2,
    fee: 3000,
    enabled: true,
    category: 2
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
    this.totalSpent = 0; // Total dépensé en USDC
    this.averagePrice = null; // Prix moyen d'achat
  }

  // Restaurer l'état depuis la sauvegarde
  restoreState(savedState) {
    if (savedState) {
      this.lastPurchasePrice = savedState.lastPurchasePrice;
      this.ath = savedState.ath;
      this.purchaseCount = savedState.purchaseCount;
      this.totalSpent = savedState.totalSpent || 0;
      this.averagePrice = savedState.averagePrice || null;
      this.emitLog('success', `[${this.config.name}] 📂 État restauré: ${this.purchaseCount} achats, ATH: ${this.ath ? this.ath.toFixed(2) : 'N/A'}, Prix moyen: ${this.averagePrice ? this.averagePrice.toFixed(2) : 'N/A'}`);
    }
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
      
      // Mettre à jour l'ATH si le prix actuel est plus élevé
      if (this.ath !== null && pricePerToken > this.ath) {
        this.ath = pricePerToken;
        this.emitLog('info', `[${this.config.name}] 🔥 Nouveau ATH: ${this.ath.toFixed(4)} USDC`);
      }
      
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

  async executeSell(percentage) {
    try {
      if (percentage <= 0 || percentage > 100) {
        throw new Error('Pourcentage invalide (doit être entre 1 et 100)');
      }

      this.emitLog('info', `[${this.config.name}] 💰 Préparation vente de ${percentage}%...`);
      
      // Récupérer la balance actuelle
      const tokenContract = new ethers.Contract(this.config.address, ERC20_ABI, this.contracts.wallet);
      const balance = await tokenContract.balanceOf(this.contracts.wallet.address);
      
      if (balance === 0n) {
        throw new Error('Balance nulle, rien à vendre');
      }

      // Calculer le montant à vendre
      const amountToSell = (balance * BigInt(percentage)) / 100n;
      
      this.emitLog('info', `[${this.config.name}] 📊 Vente de ${ethers.formatUnits(amountToSell, this.config.decimals)} ${this.config.name}`);

      // Vérifier l'allowance pour le router
      const allowance = await tokenContract.allowance(this.contracts.wallet.address, CONFIG.UNISWAP_ROUTER);
      
      if (allowance < amountToSell) {
        this.emitLog('info', `[${this.config.name}] 📝 Approbation ${this.config.name}...`);
        const approveTx = await tokenContract.approve(CONFIG.UNISWAP_ROUTER, ethers.MaxUint256);
        await approveTx.wait();
        this.emitLog('success', `[${this.config.name}] ✅ Approbation confirmée`);
      }

      // Obtenir le prix (combien d'USDC on va recevoir)
      const quote = await this.contracts.quoter.quoteExactInputSingle.staticCall({
        tokenIn: this.config.address,
        tokenOut: CONFIG.USDC,
        amountIn: amountToSell,
        fee: this.config.fee,
        sqrtPriceLimitX96: 0
      });

      const usdcOut = quote[0];
      const minUsdcOut = (usdcOut * BigInt(100 - CONFIG.SLIPPAGE_TOLERANCE)) / BigInt(100);
      
      // Exécuter la vente
      const swapParams = {
        tokenIn: this.config.address,
        tokenOut: CONFIG.USDC,
        fee: this.config.fee,
        recipient: this.contracts.wallet.address,
        amountIn: amountToSell,
        amountOutMinimum: minUsdcOut,
        sqrtPriceLimitX96: 0
      };

      const tx = await this.contracts.router.exactInputSingle(swapParams);
      this.emitLog('info', `[${this.config.name}] ⏳ TX vente: ${tx.hash}`);
      
      await tx.wait();
      
      const usdcReceived = ethers.formatUnits(usdcOut, 6);
      const sellPrice = parseFloat(usdcReceived) / parseFloat(ethers.formatUnits(amountToSell, this.config.decimals));
      
      this.emitLog('success', `[${this.config.name}] ✅ Vente confirmée!`);
      this.emitLog('success', 
        `[${this.config.name}] 💵 Reçu: ${usdcReceived} USDC à ${sellPrice.toFixed(2)} USDC/${this.config.name}`
      );

      // Calculer le profit/perte si on a un prix moyen
      if (this.averagePrice) {
        const profitPercent = ((sellPrice - this.averagePrice) / this.averagePrice) * 100;
        const profitEmoji = profitPercent > 0 ? '📈' : '📉';
        this.emitLog('success', 
          `[${this.config.name}] ${profitEmoji} P&L: ${profitPercent > 0 ? '+' : ''}${profitPercent.toFixed(2)}% (Prix moyen: ${this.averagePrice.toFixed(2)})`
        );
      }

      await this.getBalance();
      
      return {
        success: true,
        usdcReceived,
        sellPrice,
        amountSold: ethers.formatUnits(amountToSell, this.config.decimals)
      };
    } catch (error) {
      this.emitLog('error', `[${this.config.name}] ❌ Erreur vente: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async executePurchase() {
    try {
      this.emitLog('info', `[${this.config.name}] 🔄 Exécution de l'achat...`);
      
      const amountIn = ethers.parseUnits(this.config.purchaseAmount, 6);
      
      // Vérifier la balance USDC avant d'acheter
      const usdcBalance = await this.contracts.usdc.balanceOf(this.contracts.wallet.address);
      if (usdcBalance < amountIn) {
        const usdcFormatted = ethers.formatUnits(usdcBalance, 6);
        throw new Error(`Balance USDC insuffisante: ${usdcFormatted} USDC disponible, ${this.config.purchaseAmount} USDC requis`);
      }
      
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
      this.ath = this.lastPurchasePrice; // Réinitialiser l'ATH au prix d'achat
      await this.getBalance();
      
      // Calculer le prix moyen
      this.totalSpent += parseFloat(this.config.purchaseAmount);
      const balanceNumber = parseFloat(this.balance);
      if (balanceNumber > 0) {
        this.averagePrice = this.totalSpent / balanceNumber;
      }
      
      this.emitLog('success', 
        `[${this.config.name}] 📊 Achat #${this.purchaseCount} - Prix: ${this.lastPurchasePrice.toFixed(4)} USDC - Balance: ${this.balance} - Prix moyen: ${this.averagePrice ? this.averagePrice.toFixed(4) : 'N/A'} USDC`
      );
      
      // Sauvegarder l'état après chaque achat
      if (this.saveStateCallback) {
        this.saveStateCallback();
      }
      
      return true;
    } catch (error) {
      // Messages d'erreur plus clairs
      let errorMessage = error.message;
      
      if (error.message.includes('STF') || error.message.includes('SafeTransferFrom')) {
        errorMessage = 'Balance USDC insuffisante pour cet achat';
      } else if (error.message.includes('Too little received')) {
        errorMessage = 'Slippage trop élevé, augmentez SLIPPAGE_TOLERANCE';
      } else if (error.message.includes('Pool not found')) {
        errorMessage = 'Pool Uniswap non trouvé pour cette paire';
      }
      
      this.emitLog('error', `[${this.config.name}] ❌ Erreur achat: ${errorMessage}`);
      return false;
    }
  }

  shouldPurchase() {
    return this.purchaseCount < this.config.maxPurchases;
  }

  async checkAndExecute() {
    // Ne rien faire si la paire n'est pas activée
    if (!this.config.enabled) {
      return;
    }
    
    if (!this.shouldPurchase()) {
      return;
    }
    
    const currentPrice = await this.getCurrentPrice();
    if (!currentPrice) return;
    
    // Premier achat
    if (this.lastPurchasePrice === null) {
      this.emitLog('info', `[${this.config.name}] 🎯 Premier achat déclenché`);
      await this.executePurchase();
      return;
    }
    
    // L'ATH a déjà été mis à jour dans getCurrentPrice() si nécessaire
    
    // Calculer la baisse depuis l'ATH
    const dropFromATH = this.ath ? ((currentPrice - this.ath) / this.ath) * 100 : 0;
    const dropThreshold = this.config.dropPercentage || CONFIG.DROP_PERCENTAGE;
    
    // Vérifier si baisse >= seuil depuis l'ATH
    if (dropFromATH <= -dropThreshold) {
      this.emitLog('success', 
        `[${this.config.name}] 🎯 Déclenchement! Prix actuel: ${currentPrice.toFixed(4)}, ATH: ${this.ath.toFixed(4)}, Baisse: ${Math.abs(dropFromATH).toFixed(2)}%`
      );
      await this.executePurchase();
    }
  }

  getState() {
    return {
      id: this.config.id,
      name: this.config.name,
      currentPrice: this.currentPrice,
      lastPurchasePrice: this.lastPurchasePrice,
      ath: this.ath,
      purchaseCount: this.purchaseCount,
      balance: this.balance,
      dropPercentage: this.config.dropPercentage,
      averagePrice: this.averagePrice,
      totalSpent: this.totalSpent,
      priceChange: this.ath && this.currentPrice 
        ? ((this.currentPrice - this.ath) / this.ath) * 100 
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

      // Charger l'état sauvegardé
      const savedStates = loadState();

      this.pairs = [];
      for (const pairConfig of PAIRS) {
        // Ne créer des trackers que pour les paires activées
        if (!pairConfig.enabled) {
          this.emitLog('info', `⏸️ [${pairConfig.name}] Paire désactivée, ignorée`);
          continue;
        }
        
        const tracker = new PairTracker(pairConfig, this.contracts, this.emitLog.bind(this));
        
        // Ajouter le callback de sauvegarde
        tracker.saveStateCallback = () => saveState(this.pairs);
        
        // Restaurer l'état si disponible
        if (savedStates) {
          const savedState = savedStates.find(s => s.id === pairConfig.id);
          if (savedState) {
            tracker.restoreState(savedState);
          }
        }
        
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
    // Vérifier la balance USDC globale
    try {
      const usdcBalance = await this.contracts.usdc.balanceOf(this.wallet.address);
      const usdcFormatted = ethers.formatUnits(usdcBalance, 6);
      
      // Calculer le besoin minimum (une transaction par paire activée)
      const enabledPairs = this.pairs.filter(p => p.config.enabled);
      const minRequired = enabledPairs.reduce((sum, p) => sum + parseFloat(p.config.purchaseAmount), 0);
      
      if (parseFloat(usdcFormatted) < minRequired) {
        this.emitLog('error', `⚠️ Balance USDC faible: ${usdcFormatted} USDC (min recommandé: ${minRequired} USDC)`);
      }
    } catch (error) {
      console.error('Erreur vérification USDC:', error);
    }
    
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
      ...p,
      enabled: p.enabled // S'assurer que enabled est bien synchronisé
    }));
    console.log('✅ Configuration des paires mise à jour');
  }

  res.json({ success: true });
});

// Start bot
app.post('/api/start', async (req, res) => {
  console.log('📥 Requête de démarrage reçue');
  const success = await botManager.start();
  console.log(`📤 Réponse: ${success ? 'succès' : 'échec'}`);
  res.json({ success });
});

// Stop bot
app.post('/api/stop', (req, res) => {
  console.log('📥 Requête d\'arrêt reçue');
  botManager.stop();
  console.log('📤 Bot arrêté');
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

// Sell tokens
app.post('/api/sell', async (req, res) => {
  const { pairId, percentage } = req.body;
  
  if (!pairId || !percentage) {
    return res.status(400).json({ error: 'pairId et percentage requis' });
  }

  const pair = botManager.pairs.find(p => p.config.id === pairId);
  if (!pair) {
    return res.status(404).json({ error: 'Paire non trouvée' });
  }

  const result = await pair.executeSell(percentage);
  res.json(result);
});

// ==================== WEBSOCKET ====================
io.on('connection', (socket) => {
  console.log('✅ Client connecté:', socket.id);
  
  socket.emit('status', botManager.getStatus());
  socket.emit('pairs-update', botManager.getPairsState());

  socket.on('disconnect', () => {
    console.log('❌ Client déconnecté:', socket.id);
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Écoute sur toutes les interfaces

server.listen(PORT, HOST, () => {
  console.log(`🚀 Serveur démarré sur http://${HOST}:${PORT}`);
  
  if (process.env.SERVER_URL) {
    console.log(`🌐 URL publique: ${process.env.SERVER_URL}`);
  }
  
  console.log(`📡 WebSocket disponible`);
  console.log(`\n💡 Interface web: ${process.env.SERVER_URL || `http://localhost:${PORT}`}`);
  console.log(`📋 Vérifiez votre fichier .env pour la configuration`);
  console.log(`\n💰 Montants configurés:`);
  console.log(`   - AMOUNT_1 (BTC, ETH): ${CONFIG.AMOUNT_1} USDC`);
  console.log(`   - AMOUNT_2 (Autres): ${CONFIG.AMOUNT_2} USDC\n`);
});
