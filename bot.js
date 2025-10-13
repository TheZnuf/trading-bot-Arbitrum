const { ethers } = require('ethers');
require('dotenv').config();

// ==================== CONFIGURATION ====================
const CONFIG = {
  RPC_URL: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  
  // Paramètres globaux
  DROP_PERCENTAGE: 2, // Pourcentage de baisse pour déclencher un achat
  CHECK_INTERVAL: 60000, // Vérifier toutes les 60 secondes
  SLIPPAGE_TOLERANCE: 1, // 1% de slippage toléré
  
  // Adresses sur Arbitrum
  UNISWAP_ROUTER: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  QUOTER: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  
  // Configuration des paires à trader
  PAIRS: [
    {
      name: 'WBTC',
      address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
      decimals: 8,
      purchaseAmount: '1000', // en USDC
      maxPurchases: 10,
      fee: 3000, // 0.3% (pool le plus liquide pour WBTC)
      enabled: true
    },
    {
      name: 'WETH',
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      decimals: 18,
      purchaseAmount: '500',
      maxPurchases: 15,
      fee: 500, // 0.05% (pool le plus liquide pour WETH)
      enabled: true
    },
    {
      name: 'LINK',
      address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
      decimals: 18,
      purchaseAmount: '300',
      maxPurchases: 20,
      fee: 3000,
      enabled: true
    },
    {
      name: 'AVAX', // Wrapped AVAX
      address: '0x565609fAF65B92F7be02468acF86f8979423e514',
      decimals: 18,
      purchaseAmount: '400',
      maxPurchases: 12,
      fee: 3000,
      enabled: true
    },
    {
      name: 'SOL', // Wrapped SOL (via Portal/Wormhole)
      address: '0xb74Da9FE2F96B9E0a5f4A3cf0b92dd2bEC617124',
      decimals: 9,
      purchaseAmount: '600',
      maxPurchases: 10,
      fee: 10000, // 1% (pool moins liquide)
      enabled: true
    },
    {
      name: 'LDO',
      address: '0x13Ad51ed4F1B7e9Dc168d8a00cB3f4dDD85EfA60',
      decimals: 18,
      purchaseAmount: '250',
      maxPurchases: 15,
      fee: 3000,
      enabled: true
    },
    // Note: XRP n'est pas disponible sur Arbitrum via Uniswap
    // Si vous voulez XRP, il faudrait utiliser un bridge ou un autre DEX
  ]
};

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
  constructor(config, contracts) {
    this.config = config;
    this.contracts = contracts;
    this.lastPurchasePrice = null;
    this.purchaseCount = 0;
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
      
      // Prix = USDC dépensé / Token reçu
      const pricePerToken = parseFloat(this.config.purchaseAmount) / 
                           parseFloat(ethers.formatUnits(tokenOut, this.config.decimals));
      
      return pricePerToken;
    } catch (error) {
      console.error(`❌ [${this.config.name}] Erreur prix:`, error.message);
      return null;
    }
  }

  async executePurchase() {
    try {
      console.log(`\n🔄 [${this.config.name}] Exécution de l'achat...`);
      
      const amountIn = ethers.parseUnits(this.config.purchaseAmount, 6);
      
      // Vérifier l'allowance
      const allowance = await this.contracts.usdc.allowance(
        this.contracts.wallet.address, 
        CONFIG.UNISWAP_ROUTER
      );
      
      if (allowance < amountIn) {
        console.log(`📝 [${this.config.name}] Approbation USDC...`);
        const approveTx = await this.contracts.usdc.approve(CONFIG.UNISWAP_ROUTER, ethers.MaxUint256);
        await approveTx.wait();
        console.log(`✅ [${this.config.name}] Approbation confirmée`);
      }
      
      // Obtenir le montant minimum avec slippage
      const quote = await this.contracts.quoter.quoteExactInputSingle.staticCall({
        tokenIn: CONFIG.USDC,
        tokenOut: this.config.address,
        amountIn: amountIn,
        fee: this.config.fee,
        sqrtPriceLimitX96: 0
      });
      
      const amountOutMin = (quote[0] * BigInt(100 - CONFIG.SLIPPAGE_TOLERANCE)) / BigInt(100);
      
      // Exécuter le swap
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
      console.log(`⏳ [${this.config.name}] TX: ${tx.hash}`);
      
      await tx.wait();
      console.log(`✅ [${this.config.name}] Achat confirmé!`);
      
      this.purchaseCount++;
      this.lastPurchasePrice = await this.getCurrentPrice();
      
      const tokenContract = new ethers.Contract(this.config.address, ERC20_ABI, this.contracts.wallet);
      const balance = await tokenContract.balanceOf(this.contracts.wallet.address);
      const balanceFormatted = ethers.formatUnits(balance, this.config.decimals);
      
      console.log(`📊 [${this.config.name}] Résumé:`);
      console.log(`   - Achat #${this.purchaseCount}`);
      console.log(`   - Prix: ${this.lastPurchasePrice.toFixed(4)} USDC/${this.config.name}`);
      console.log(`   - Balance totale: ${balanceFormatted} ${this.config.name}`);
      console.log(`   - Achats restants: ${this.config.maxPurchases - this.purchaseCount}`);
      
      return true;
    } catch (error) {
      console.error(`❌ [${this.config.name}] Erreur achat:`, error.message);
      return false;
    }
  }

  shouldPurchase() {
    if (this.purchaseCount >= this.config.maxPurchases) {
      return false;
    }
    return true;
  }

  async checkAndExecute() {
    if (!this.shouldPurchase()) {
      return;
    }
    
    const currentPrice = await this.getCurrentPrice();
    if (!currentPrice) return;
    
    const timestamp = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Zurich' });
    console.log(`[${timestamp}] 💹 [${this.config.name}] Prix: ${currentPrice.toFixed(4)} USDC`);
    
    // Premier achat
    if (this.lastPurchasePrice === null) {
      console.log(`🎯 [${this.config.name}] Premier achat déclenché`);
      await this.executePurchase();
      return;
    }
    
    // Calculer la variation
    const priceChange = ((currentPrice - this.lastPurchasePrice) / this.lastPurchasePrice) * 100;
    console.log(`   📉 [${this.config.name}] Variation: ${priceChange.toFixed(2)}%`);
    
    // Vérifier si baisse >= 2%
    if (priceChange <= -CONFIG.DROP_PERCENTAGE) {
      console.log(`\n🎯 [${this.config.name}] Déclenchement! Baisse de ${Math.abs(priceChange).toFixed(2)}%`);
      await this.executePurchase();
    }
  }
}

// ==================== MULTI-PAIR BOT ====================
class MultiPairDCABot {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    this.wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, this.provider);
    
    this.contracts = {
      wallet: this.wallet,
      usdc: new ethers.Contract(CONFIG.USDC, ERC20_ABI, this.wallet),
      quoter: new ethers.Contract(CONFIG.QUOTER, QUOTER_ABI, this.provider),
      router: new ethers.Contract(CONFIG.UNISWAP_ROUTER, ROUTER_ABI, this.wallet)
    };
    
    this.pairs = [];
    this.isRunning = false;
  }

  async init() {
    console.log('🚀 Initialisation du bot DCA Multi-Paires...');
    console.log(`📍 Wallet: ${this.wallet.address}`);
    
    const usdcBalance = await this.contracts.usdc.balanceOf(this.wallet.address);
    const usdcFormatted = ethers.formatUnits(usdcBalance, 6);
    console.log(`💰 Balance USDC: ${usdcFormatted}\n`);
    
    console.log('⚙️ Configuration des paires:');
    
    // Initialiser les trackers pour chaque paire activée
    for (const pairConfig of CONFIG.PAIRS) {
      if (!pairConfig.enabled) continue;
      
      const tracker = new PairTracker(pairConfig, this.contracts);
      this.pairs.push(tracker);
      
      // Afficher la balance actuelle
      const tokenContract = new ethers.Contract(pairConfig.address, ERC20_ABI, this.wallet);
      const balance = await tokenContract.balanceOf(this.wallet.address);
      const balanceFormatted = ethers.formatUnits(balance, pairConfig.decimals);
      
      console.log(`   ${pairConfig.name}:`);
      console.log(`      - Montant/achat: ${pairConfig.purchaseAmount} USDC`);
      console.log(`      - Max achats: ${pairConfig.maxPurchases}`);
      console.log(`      - Balance actuelle: ${balanceFormatted}`);
    }
    
    console.log(`\n📊 Paramètres globaux:`);
    console.log(`   - Déclenchement: baisse de ${CONFIG.DROP_PERCENTAGE}%`);
    console.log(`   - Slippage toléré: ${CONFIG.SLIPPAGE_TOLERANCE}%`);
    console.log(`   - Vérification: toutes les ${CONFIG.CHECK_INTERVAL/1000}s\n`);
  }

  async checkAllPairs() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    for (const pair of this.pairs) {
      await pair.checkAndExecute();
    }
    
    // Vérifier si toutes les paires ont atteint leur limite
    const allComplete = this.pairs.every(p => !p.shouldPurchase());
    if (allComplete) {
      console.log('\n⛔ Toutes les paires ont atteint leur limite! Arrêt du bot.');
      this.stop();
    }
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Le bot est déjà en cours d\'exécution');
      return;
    }
    
    this.isRunning = true;
    console.log('▶️ Bot démarré!\n');
    
    this.intervalId = setInterval(() => {
      this.checkAllPairs();
    }, CONFIG.CHECK_INTERVAL);
    
    // Première vérification immédiate
    this.checkAllPairs();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.isRunning = false;
      console.log('\n⏸️ Bot arrêté');
      
      // Afficher le résumé
      console.log('\n📊 Résumé final:');
      for (const pair of this.pairs) {
        console.log(`   ${pair.config.name}: ${pair.purchaseCount}/${pair.config.maxPurchases} achats effectués`);
      }
    }
  }
}

// ==================== MAIN ====================
async function main() {
  if (!CONFIG.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY manquante! Créez un fichier .env');
    process.exit(1);
  }
  
  const bot = new MultiPairDCABot();
  await bot.init();
  bot.start();
  
  // Gérer l'arrêt propre
  process.on('SIGINT', () => {
    console.log('\n\n👋 Arrêt du bot...');
    bot.stop();
    process.exit(0);
  });
}

main().catch(console.error);
