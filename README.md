# 🤖 Bot DCA WBTC sur Arbitrum

Bot de trading automatique qui achète du WBTC (Wrapped Bitcoin) sur Uniswap V3 (Arbitrum) à chaque baisse de 2%.

## 📋 Prérequis

1. **Node.js** (version 18+)
2. **Un wallet Arbitrum** avec:
   - ETH pour les frais de gas (~5-10$ recommandés)
   - USDC pour les achats
3. **Un compte RPC** (gratuit):
   - [Alchemy](https://alchemy.com) ou [Infura](https://infura.io)

## 🚀 Installation

### 1. Créer le dossier du projet
```bash
mkdir dca-wbtc-bot
cd dca-wbtc-bot
```

### 2. Créer les fichiers
Créez les 3 fichiers suivants dans le dossier:
- `bot.js` (le code principal)
- `package.json` (les dépendances)
- `.env` (votre configuration)

### 3. Installer les dépendances
```bash
npm install
```

### 4. Configuration

Créez un fichier `.env` avec:

```env
PRIVATE_KEY=votre_cle_privee_metamask
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/VOTRE_CLE
PURCHASE_AMOUNT=1000
MAX_PURCHASES=10
```

**⚠️ IMPORTANT - Obtenir votre clé privée:**
1. Ouvrez MetaMask
2. Cliquez sur les 3 points → Détails du compte
3. Exporter la clé privée
4. **NE JAMAIS LA PARTAGER!**

**📡 Obtenir un RPC gratuit (Alchemy):**
1. Allez sur [alchemy.com](https://alchemy.com)
2. Créez un compte gratuit
3. Créez une nouvelle app → Choisir "Arbitrum"
4. Copiez l'URL HTTPS

## ▶️ Lancer le bot

```bash
npm start
```

Le bot va:
1. Faire un premier achat immédiatement (1000 USDC → WBTC)
2. Surveiller le prix toutes les 60 secondes
3. Acheter à nouveau à chaque baisse de 2%
4. S'arrêter après 10 achats (configurable)

## 🛑 Arrêter le bot

Appuyez sur `Ctrl + C`

## ⚙️ Personnalisation

Vous pouvez modifier ces paramètres dans le fichier `.env`:

- `PURCHASE_AMOUNT`: Montant en USDC par achat (défaut: 1000)
- `MAX_PURCHASES`: Nombre maximum d'achats (défaut: 10)

Ou directement dans `bot.js`:
- `DROP_PERCENTAGE`: Pourcentage de baisse (ligne 14, défaut: 2%)
- `CHECK_INTERVAL`: Fréquence de vérification en ms (ligne 15, défaut: 60000 = 1 min)
- `SLIPPAGE_TOLERANCE`: Slippage toléré (ligne 16, défaut: 1%)

## 📊 Exemple de sortie

```
🚀 Initialisation du bot DCA WBTC...
📍 Wallet: 0x123...abc
💰 Balance USDC: 10000.00
₿ Balance WBTC: 0.05

⚙️ Configuration:
   - Montant par achat: 1000 USDC
   - Déclenchement: baisse de 2%
   - Limite d'achats: 10
   - Slippage toléré: 1%

▶️ Bot démarré!

[13/10/2025 14:30:00] 💹 Prix actuel: 45000.50 USDC/WBTC
🎯 Premier achat déclenché

🔄 Exécution de l'achat...
⏳ Transaction envoyée: 0xabc...123
✅ Achat confirmé!
📊 Résumé:
   - Achat #1
   - Prix d'achat: 45000.50 USDC/WBTC
   - Balance WBTC totale: 0.07222
   - Achats restants: 9
```

## 🔒 Sécurité

- ✅ Limite de dépense (MAX_PURCHASES)
- ✅ Slippage protection
- ✅ Clé privée stockée localement uniquement
- ⚠️ Ne laissez pas votre `.env` sur GitHub!
- ⚠️ Testez d'abord avec de petits montants

## ⚠️ Avertissements

- Ce bot achète automatiquement, assurez-vous d'avoir assez d'USDC
- Les frais de gas sont à votre charge (~0.50-2$ par transaction)
- Le prix peut varier entre la lecture et l'exécution (slippage)
- **Risque de marché**: si le BTC baisse beaucoup, tous vos achats seront déclenchés rapidement

## 🐛 Résolution de problèmes

**"PRIVATE_KEY manquante"**
→ Créez un fichier `.env` avec votre clé privée

**"Insufficient funds"**
→ Assurez-vous d'avoir assez d'USDC + ETH pour le gas

**"Slippage tolerance exceeded"**
→ Augmentez `SLIPPAGE_TOLERANCE` dans le code (ligne 16)

**Prix ne se met pas à jour**
→ Vérifiez votre connexion RPC (Alchemy/Infura)

## 💡 Conseils

1. **Testez d'abord** avec `PURCHASE_AMOUNT=10` pour vous familiariser
2. **Surveillez les frais** de gas sur [Arbiscan](https://arbiscan.io)
3. **Gardez une réserve** d'ETH pour les frais
4. **Notez vos achats** pour suivre votre DCA

## 📚 Ressources

- [Documentation Uniswap V3](https://docs.uniswap.org)
- [Arbiscan Explorer](https://arbiscan.io)
- [Prix WBTC en temps réel](https://www.coingecko.com/en/coins/wrapped-bitcoin)

---

**⚡ Fait avec ❤️ pour DCA sur Arbitrum**
