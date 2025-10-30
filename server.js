const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { ethers } = require('ethers');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const notifier = require('./notifier');
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
const PAIRS_FILE = path.join(__dirname, 'pairs.json');

// ==================== STATE MANAGEMENT ====================
function saveState(pairs) {
  try {
    const state = {
      timestamp: new Date().toISOString(),
      pairs: pairs.map(p => ({
        id: p.config.id,
        name: p.config.name,
        lastPurchasePrice: p.lastPurchasePrice ? p.lastPurchasePrice.toString() : null,
        ath: p.ath ? p.ath.toString() : null,
        purchaseCount: p.purchaseCount,
        totalSpent: p.totalSpent.toString(),
        averagePrice: p.averagePrice ? p.averagePrice.toString() : null
      }))
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    logger.info('💾 État sauvegardé');
  } catch (error) {
    logger.error('❌ Erreur sauvegarde état:', error);
  }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const state = JSON.parse(data);
      logger.info('📂 État chargé depuis: %s', state.timestamp);
      return state.pairs;
    }
  } catch (error) {
    logger.error('❌ Erreur chargement état:', error);
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

function loadPairsConfig() {
  try {
    if (fs.existsSync(PAIRS_FILE)) {
      const data = fs.readFileSync(PAIRS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('❌ Erreur chargement config paires:', error);
  }
  return [];
}

function savePairsConfig(pairs) {
  try {
    fs.writeFileSync(PAIRS_FILE, JSON.stringify(pairs, null, 2));
    logger.info('💾 Configuration des paires sauvegardée');
  } catch (error) {
    logger.error('❌ Erreur sauvegarde config paires:', error);
  }
}

let PAIRS = loadPairsConfig();

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
    this.lastPurchasePrice = null; // BigInt with 18 decimals
    this.ath = null; // BigInt with 18 decimals
    this.purchaseCount = 0;
    this.currentPrice = null; // BigInt with 18 decimals
    this.balance = '0';
    this.rawBalance = 0n;
    this.totalSpent = 0n; // BigInt in USDC units (6 decimals)
    this.averagePrice = null; // BigInt with 18 decimals
    this.purchaseAmount = CONFIG[this.config.purchaseAmountKey];
  }

  // Restaurer l'état depuis la sauvegarde
  restoreState(savedState) {
    if (savedState) {
      this.lastPurchasePrice = savedState.lastPurchasePrice ? BigInt(savedState.lastPurchasePrice) : null;
      this.ath = savedState.ath ? BigInt(savedState.ath) : null;
      this.purchaseCount = savedState.purchaseCount;
      this.totalSpent = savedState.totalSpent ? BigInt(savedState.totalSpent) : 0n;
      this.averagePrice = savedState.averagePrice ? BigInt(savedState.averagePrice) : null;
      this.emitLog('success', `[${this.config.name}] 📂 État restauré: ${this.purchaseCount} achats, ATH: ${this.ath ? parseFloat(ethers.formatUnits(this.ath, 18)).toFixed(2) : 'N/A'}, Prix moyen: ${this.averagePrice ? parseFloat(ethers.formatUnits(this.averagePrice, 18)).toFixed(2) : 'N/A'}`);
    }
  }

  async getCurrentPrice() {
    try {
      const amountIn = ethers.parseUnits(this.purchaseAmount, 6);
      
      const params = {
        tokenIn: CONFIG.USDC,
        tokenOut: this.config.address,
        amountIn: amountIn,
        fee: this.config.fee,
        sqrtPriceLimitX96: 0
      };
      
      const quote = await this.contracts.quoter.quoteExactInputSingle.staticCall(params);
      const tokenOut = quote[0];

      if (tokenOut === 0n) {
        this.emitLog('error', `[${this.config.name}] Erreur prix: Le quoter a retourné 0`);
        return null;
      }

      // Prix avec 18 décimales de précision
      const pricePerTokenBN = (amountIn * (10n ** BigInt(this.config.decimals)) * (10n ** 18n)) / (tokenOut * (10n ** 6n));
      
      this.currentPrice = pricePerTokenBN;
      
      // Mettre à jour l'ATH si le prix actuel est plus élevé
      if (this.ath !== null && pricePerTokenBN > this.ath) {
        this.ath = pricePerTokenBN;
        this.emitLog('info', `[${this.config.name}] 🔥 Nouveau ATH: ${ethers.formatUnits(this.ath, 18)} USDC`);
      }
      
      return pricePerTokenBN;
    } catch (error) {
      this.emitLog('error', `[${this.config.name}] Erreur prix: ${error.message}`);
      return null;
    }
  }

  async getBalance() {
    try {
      const tokenContract = new ethers.Contract(this.config.address, ERC20_ABI, this.contracts.wallet);
      const balance = await tokenContract.balanceOf(this.contracts.wallet.address);
      this.rawBalance = balance;
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
      const sellPriceBN = (usdcOut * (10n ** BigInt(this.config.decimals)) * (10n ** 18n)) / (amountToSell * (10n ** 6n));
      const sellPrice = parseFloat(ethers.formatUnits(sellPriceBN, 18));
      
      this.emitLog('success', `[${this.config.name}] ✅ Vente confirmée!`);
      this.emitLog('success', 
        `[${this.config.name}] 💵 Reçu: ${usdcReceived} USDC à ${sellPrice.toFixed(2)} USDC/${this.config.name}`
      );

      // Calculer le profit/perte si on a un prix moyen
      if (this.averagePrice) {
        const profitPercent = Number((sellPriceBN - this.averagePrice) * 10000n / this.averagePrice) / 100;
        const profitEmoji = profitPercent > 0 ? '📈' : '📉';
        this.emitLog('success', 
          `[${this.config.name}] ${profitEmoji} P&L: ${profitPercent > 0 ? '+' : ''}${profitPercent.toFixed(2)}% (Prix moyen: ${parseFloat(ethers.formatUnits(this.averagePrice, 18)).toFixed(2)})`
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
      
      const amountIn = ethers.parseUnits(this.purchaseAmount, 6);
      
      // Vérifier la balance USDC avant d'acheter
      const usdcBalance = await this.contracts.usdc.balanceOf(this.contracts.wallet.address);
      if (usdcBalance < amountIn) {
        const usdcFormatted = ethers.formatUnits(usdcBalance, 6);
        throw new Error(`Balance USDC insuffisante: ${usdcFormatted} USDC disponible, ${this.purchaseAmount} USDC requis`);
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
      
      // Mettre à jour la balance et calculer le prix moyen
      this.totalSpent += ethers.parseUnits(this.purchaseAmount, 6);
      await this.getBalance(); // Met à jour this.rawBalance
      if (this.rawBalance > 0n) {
        this.averagePrice = (this.totalSpent * (10n ** BigInt(this.config.decimals)) * (10n ** 18n)) / (this.rawBalance * (10n ** 6n));
      }
      
      this.emitLog('success', 
        `[${this.config.name}] 📊 Achat #${this.purchaseCount} - Prix: ${parseFloat(ethers.formatUnits(this.lastPurchasePrice, 18)).toFixed(4)} USDC - Balance: ${this.balance} - Prix moyen: ${this.averagePrice ? parseFloat(ethers.formatUnits(this.averagePrice, 18)).toFixed(4) : 'N/A'} USDC`
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
    
    // Calculer la baisse depuis l'ATH en BigInt (pourcentage * 100 pour 2 décimales de précision)
    const dropFromATH = this.ath ? ((currentPrice - this.ath) * 10000n) / this.ath : 0n;
    const dropThreshold = BigInt((this.config.dropPercentage || CONFIG.DROP_PERCENTAGE) * 100);
    
    // Vérifier si baisse >= seuil depuis l'ATH
    if (dropFromATH <= -dropThreshold) {
      this.emitLog('success', 
        `[${this.config.name}] 🎯 Déclenchement! Prix actuel: ${parseFloat(ethers.formatUnits(currentPrice, 18)).toFixed(4)}, ATH: ${parseFloat(ethers.formatUnits(this.ath, 18)).toFixed(4)}, Baisse: ${Math.abs(Number(dropFromATH) / 100).toFixed(2)}%`
      );
      await this.executePurchase();
    }
  }

  getState() {
    const priceChange = this.ath && this.currentPrice && this.ath > 0n
      ? Number((this.currentPrice - this.ath) * 10000n / this.ath) / 100
      : 0;

    return {
      id: this.config.id,
      name: this.config.name,
      currentPrice: this.currentPrice ? ethers.formatUnits(this.currentPrice, 18) : null,
      lastPurchasePrice: this.lastPurchasePrice ? ethers.formatUnits(this.lastPurchasePrice, 18) : null,
      ath: this.ath ? ethers.formatUnits(this.ath, 18) : null,
      purchaseCount: this.purchaseCount,
      balance: this.balance,
      dropPercentage: this.config.dropPercentage,
      averagePrice: this.averagePrice ? ethers.formatUnits(this.averagePrice, 18) : null,
      totalSpent: ethers.formatUnits(this.totalSpent, 6),
      priceChange: priceChange
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

    // Envoyer une notification Telegram pour les erreurs et succès
    if (type === 'error' || type === 'success') {
      let telegramMessage = `<b>${log.type.toUpperCase()}</b>: ${log.message}`;
      notifier.sendTelegramMessage(telegramMessage);
    }
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
      const minRequired = enabledPairs.reduce((sum, p) => sum + ethers.parseUnits(p.purchaseAmount, 6), 0n);
      
      if (usdcBalance < minRequired) {
        this.emitLog('error', `⚠️ Balance USDC faible: ${usdcFormatted} USDC (min recommandé: ${ethers.formatUnits(minRequired, 6)} USDC)`);
      }
    } catch (error) {
      logger.error('Erreur vérification USDC:', error);
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
    pairs: PAIRS.map(p => ({
      ...p,
      purchaseAmount: CONFIG[p.purchaseAmountKey] || p.purchaseAmount // Retourner le montant réel basé sur CONFIG
    }))
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
    // Mettre à jour la configuration en mémoire
    PAIRS = pairs.map(p => {
      const existingPair = PAIRS.find(ep => ep.id === p.id);
      return { ...existingPair, ...p };
    });

    // Sauvegarder une version propre sans les champs dérivés
    const pairsToSave = PAIRS.map(p => {
      const { purchaseAmount, ...rest } = p; // 'purchaseAmount' est dérivé, on ne le sauvegarde pas
      return rest;
    });

    savePairsConfig(pairsToSave);
    logger.info('✅ Configuration des paires mise à jour et sauvegardée');
  }

  res.json({ success: true });
});

// Start bot
app.post('/api/start', async (req, res) => {
  logger.info('📥 Requête de démarrage reçue');
  const success = await botManager.start();
  logger.info(`📤 Réponse: ${success ? 'succès' : 'échec'}`);
  res.json({ success });
});

// Stop bot
app.post('/api/stop', (req, res) => {
  logger.info('📥 Requête d\'arrêt reçue');
  botManager.stop();
  logger.info('📤 Bot arrêté');
  res.json({ success: true });
});

// Get status
app.get('/api/status', (req, res) => {
  res.json(botManager.getStatus());
});

// Get pairs state
app.get('/api/pairs', (req, res) => {
  // Si le bot n'est pas initialisé, retourner un état vide avec les IDs
  if (botManager.pairs.length === 0) {
    const emptyState = PAIRS.map(p => ({
      id: p.id,
      name: p.name,
      currentPrice: null,
      lastPurchasePrice: null,
      ath: null,
      purchaseCount: 0,
      balance: '0',
      dropPercentage: p.dropPercentage,
      averagePrice: null,
      totalSpent: 0,
      priceChange: 0,
      purchaseAmount: CONFIG[p.purchaseAmountKey] || '0' // Utiliser la clé pour obtenir le montant
    }));
    return res.json(emptyState);
  }
  
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
  logger.info('✅ Client connecté: %s', socket.id);
  
  socket.emit('status', botManager.getStatus());
  socket.emit('pairs-update', botManager.getPairsState());

  socket.on('disconnect', () => {
    logger.info('❌ Client déconnecté: %s', socket.id);
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Écoute sur toutes les interfaces

server.listen(PORT, HOST, () => {
  logger.info(`🚀 Serveur démarré sur http://${HOST}:${PORT}`);
  
  if (process.env.SERVER_URL) {
    logger.info(`🌐 URL publique: ${process.env.SERVER_URL}`);
  }
  
  logger.info(`📡 WebSocket disponible`);
  logger.info(`\n💡 Interface web: ${process.env.SERVER_URL || `http://localhost:${PORT}`}`);
  logger.info(`📋 Vérifiez votre fichier .env pour la configuration`);
  logger.info(`\n💰 Montants configurés:`);
  logger.info(`   - AMOUNT_1 (BTC, ETH): ${CONFIG.AMOUNT_1} USDC`);
  logger.info(`   - AMOUNT_2 (Autres): ${CONFIG.AMOUNT_2} USDC\n`);
});
