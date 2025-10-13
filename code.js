const { ethers } = require('ethers');
require('dotenv').config();

// ==================== CONFIGURATION ====================
const CONFIG = {
  // RPC Arbitrum (obtenir gratuitement sur alchemy.com ou infura.io)
  RPC_URL: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
  
  // Votre clé privée (ATTENTION: ne jamais partager!)
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  
  // Paramètres du bot
  PURCHASE_AMOUNT: process.env.PURCHASE_AMOUNT || '1000', // en USDC
  DROP_PERCENTAGE: 2, // Pourcentage de baisse pour déclencher un achat
  MAX_PURCHASES: parseInt(process.env.MAX_PURCHASES) || 10, // Limite de sécurité
  CHECK_INTERVAL: 60000, // Vérifier toutes les 60 secondes
  SLIPPAGE_TOLERANCE: 1, // 1% de slippage toléré
  
  // Adresses des contrats sur Arbitrum
  UNISWAP_ROUTER: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // SwapRouter02
  WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  QUOTER: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // QuoterV2
};

// ABIs simplifiés
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)'
];

const QUOTER_ABI = [
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
];

const ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
];

// ==================== BOT ====================
class DCABot {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    this.wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, this.provider);
    
    this.usdcContract = new ethers.Contract(CONFIG.USDC, ERC20_ABI, this.wallet);
    this.wbtcContract = new ethers.Contract(CONFIG.WBTC, ERC20_ABI, this.wallet);
    this.quoter = new ethers.Contract(CONFIG.QUOTER, QUOTER_ABI, this.provider);
    this.router = new ethers.Contract(CONFIG.UNISWAP_ROUTER, ROUTER_ABI, this.wallet);
    
    this.lastPurchasePrice = null;
    this.purchaseCount = 0;
    this.isRunning = false;
  }

  async init() {
    console.log('🚀 Initialisation du bot DCA WBTC...');
    console.log(`📍 Wallet: ${this.wallet.address}`);
    
    const usdcBalance = await this.usdcContract.balanceOf(this.wallet.address);
    const usdcFormatted = ethers.formatUnits(usdcBalance, 6);
    console.log(`💰 Balance USDC: ${usdcFormatted}`);
    
    const wbtcBalance = await this.wbtcContract.balanceOf(this.wallet.address);
    const wbtcFormatted = ethers.formatUnits(wbtcBalance, 8);
    console.log(`₿ Balance WBTC: ${wbtcFormatted}`);
    
    console.log(`\n⚙️ Configuration:`);
    console.log(`   - Montant par achat: ${CONFIG.PURCHASE_AMOUNT} USDC`);
    console.log(`   - Déclenchement: baisse de ${CONFIG.DROP_PERCENTAGE}%`);
    console.log(`   - Limite d'achats: ${CONFIG.MAX_PURCHASES}`);
    console.log(`   - Slippage toléré: ${CONFIG.SLIPPAGE_TOLERANCE}%\n`);
  }

  async getCurrentPrice() {
    try {
      const amountIn = ethers.parseUnits(CONFIG.PURCHASE_AMOUNT, 6);
      
      const params = {
        tokenIn: CONFIG.USDC,
        tokenOut: CONFIG.WBTC,
        amountIn: amountIn,
        fee: 3000, // 0.3% fee tier (le plus liquide)
        sqrtPriceLimitX96: 0
      };
      
      const quote = await this.quoter.quoteExactInputSingle.staticCall(params);
      const wbtcOut = quote[0];
      
      // Prix = USDC dépensé / WBTC reçu
      const pricePerWBTC = parseFloat(CONFIG.PURCHASE_AMOUNT) / parseFloat(ethers.formatUnits(wbtcOut, 8));
      
      return pricePerWBTC;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du prix:', error.message);
      return null;
    }
  }

  async executePurchase() {
    try {
      console.log('\n🔄 Exécution de l\'achat...');
      
      const amountIn = ethers.parseUnits(CONFIG.PURCHASE_AMOUNT, 6);
      
      // Vérifier l'allowance
      const allowance = await this.usdcContract.allowance(this.wallet.address, CONFIG.UNISWAP_ROUTER);
      if (allowance < amountIn) {
        console.log('📝 Approbation USDC...');
        const approveTx = await this.usdcContract.approve(CONFIG.UNISWAP_ROUTER, ethers.MaxUint256);
        await approveTx.wait();
        console.log('✅ Approbation confirmée');
      }
      
      // Obtenir le montant minimum avec slippage
      const quote = await this.quoter.quoteExactInputSingle.staticCall({
        tokenIn: CONFIG.USDC,
        tokenOut: CONFIG.WBTC,
        amountIn: amountIn,
        fee: 3000,
        sqrtPriceLimitX96: 0
      });
      
      const amountOutMin = (quote[0] * BigInt(100 - CONFIG.SLIPPAGE_TOLERANCE)) / BigInt(100);
      
      // Exécuter le swap
      const swapParams = {
        tokenIn: CONFIG.USDC,
        tokenOut: CONFIG.WBTC,
        fee: 3000,
        recipient: this.wallet.address,
        amountIn: amountIn,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0
      };
      
      const tx = await this.router.exactInputSingle(swapParams);
      console.log(`⏳ Transaction envoyée: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log('✅ Achat confirmé!');
      
      this.purchaseCount++;
      this.lastPurchasePrice = await this.getCurrentPrice();
      
      const wbtcBalance = await this.wbtcContract.balanceOf(this.wallet.address);
      const wbtcFormatted = ethers.formatUnits(wbtcBalance, 8);
      
      console.log(`📊 Résumé:`);
      console.log(`   - Achat #${this.purchaseCount}`);
      console.log(`   - Prix d'achat: ${this.lastPurchasePrice.toFixed(2)} USDC/WBTC`);
      console.log(`   - Balance WBTC totale: ${wbtcFormatted}`);
      console.log(`   - Achats restants: ${CONFIG.MAX_PURCHASES - this.purchaseCount}`);
      
      return true;
    } catch (error) {
      console.error('❌ Erreur lors de l\'achat:', error.message);
      return false;
    }
  }

  async checkAndExecute() {
    if (this.purchaseCount >= CONFIG.MAX_PURCHASES) {
      console.log('\n⛔ Limite d\'achats atteinte! Arrêt du bot.');
      this.stop();
      return;
    }
    
    const currentPrice = await this.getCurrentPrice();
    if (!currentPrice) return;
    
    const timestamp = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Zurich' });
    console.log(`[${timestamp}] 💹 Prix actuel: ${currentPrice.toFixed(2)} USDC/WBTC`);
    
    // Premier achat
    if (this.lastPurchasePrice === null) {
      console.log('🎯 Premier achat déclenché');
      await this.executePurchase();
      return;
    }
    
    // Calculer la baisse depuis le dernier achat
    const priceChange = ((currentPrice - this.lastPurchasePrice) / this.lastPurchasePrice) * 100;
    console.log(`   📉 Variation: ${priceChange.toFixed(2)}% depuis le dernier achat`);
    
    // Vérifier si baisse >= 2%
    if (priceChange <= -CONFIG.DROP_PERCENTAGE) {
      console.log(`\n🎯 Déclenchement! Baisse de ${Math.abs(priceChange).toFixed(2)}%`);
      await this.executePurchase();
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
      this.checkAndExecute();
    }, CONFIG.CHECK_INTERVAL);
    
    // Première vérification immédiate
    this.checkAndExecute();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.isRunning = false;
      console.log('\n⏸️ Bot arrêté');
    }
  }
}

// ==================== MAIN ====================
async function main() {
  if (!CONFIG.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY manquante! Créez un fichier .env avec votre clé privée.');
    process.exit(1);
  }
  
  const bot = new DCABot();
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
