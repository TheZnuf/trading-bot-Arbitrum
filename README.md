# 🤖 Bot DCA Multi-Paires avec Interface Web

Bot de trading automatique DCA (Dollar Cost Averaging) sur Arbitrum avec interface web de gestion en temps réel.

## ✨ Fonctionnalités

- ✅ **Multi-paires** : WBTC, WETH, LINK, AVAX, SOL, LDO
- ✅ **Interface web moderne** : Gestion visuelle de toutes les paires
- ✅ **Temps réel** : Mises à jour en direct via WebSocket
- ✅ **Configuration flexible** : Montants et limites par paire
- ✅ **Journal d'activité** : Logs en temps réel
- ✅ **Sécurité** : Limites d'achats configurables

## 📋 Prérequis

1. **Node.js** version 18 ou supérieure
2. **Un wallet Arbitrum** avec :
   - ETH pour les frais de gas (~10$ recommandés)
   - USDC pour les achats
3. **Un RPC Arbitrum** (gratuit sur [Alchemy](https://alchemy.com))

## 🚀 Installation

### 1. Créer le projet

```bash
mkdir dca-bot
cd dca-bot
```

### 2. Créer la structure des fichiers

```
dca-bot/
├── server.js          # Backend API + Bot
├── package.json       # Dépendances
├── .env              # Configuration (à créer)
└── public/
    └── index.html    # Interface web
```

### 3. Installer les dépendances

```bash
npm install
```

### 4. Configuration

Créez un fichier `.env` à la racine :

```env
# Configuration obligatoire
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/VOTRE_CLE_API
PRIVATE_KEY=votre_cle_privee_metamask

# Port du serveur (optionnel)
PORT=3000
```

**⚠️ Comment obtenir votre clé privée :**
1. Ouvrez MetaMask
2. Menu (3 points) → Détails du compte
3. Exporter la clé privée
4. **ATTENTION : Ne la partagez JAMAIS !**

**📡 Obtenir un RPC gratuit (Alchemy) :**
1. Créez un compte sur [alchemy.com](https://alchemy.com)
2. Créez une nouvelle app
3. Sélectionnez "Arbitrum" → "Arbitrum Mainnet"
4. Copiez l'URL HTTPS

### 5. Créer le dossier public

```bash
mkdir public
```

Placez le fichier `index.html` dans le dossier `public/`.

## ▶️ Démarrage

### Lancer le serveur

```bash
npm start
```

Vous verrez :
```
🚀 Serveur démarré sur http://localhost:3000
📡 WebSocket disponible sur ws://localhost:3000
```

### Accéder à l'interface

Ouvrez votre navigateur : **http://localhost:3000**

## 🎮 Utilisation

### 1. Configuration initiale

1. Cliquez sur **"⚙️ Paramètres"**
2. Remplissez :
   - RPC URL (depuis Alchemy)
   - Clé privée (depuis MetaMask)
   - Pourcentage de baisse (défaut: 2%)
   - Intervalle de vérification (défaut: 60s)
3. Cliquez sur **"💾 Sauvegarder"**

### 2. Configuration des paires

Pour chaque paire, vous pouvez :
- **ON/OFF** : Activer/désactiver la paire
- **Montant** : Montant en USDC par achat
- **Max Achats** : Nombre maximum d'achats

### 3. Lancer le bot

1. Vérifiez que vos paires sont bien configurées
2. Cliquez sur **"▶️ Démarrer"**
3. Le bot commence immédiatement à surveiller les prix
4. Les achats se déclenchent automatiquement à chaque baisse de 2%

### 4. Surveillance

L'interface affiche en temps réel :
- **Prix actuels** de chaque token
- **Variations** depuis le dernier achat
- **Nombre d'achats** effectués
- **Balance** de chaque token
- **Logs** de toutes les actions

### 5. Arrêt

Cliquez sur **"⏸️ Arrêter"** pour stopper le bot proprement.

## 📊 Configuration des paires par défaut

| Paire | Montant | Max Achats | Budget Max |
|-------|---------|------------|------------|
| WBTC  | 1000 $  | 10         | 10,000 $   |
| WETH  | 500 $   | 15         | 7,500 $    |
| LINK  | 300 $   | 20         | 6,000 $    |
| AVAX  | 400 $   | 12         | 4,800 $    |
| SOL   | 600 $   | 10         | 6,000 $    |
| LDO   | 250 $   | 15         | 3,750 $    |

**Budget total maximum : ~38,050 $**

## ⚙️ Personnalisation

### Modifier une paire

Dans `server.js`, modifiez la section `PAIRS` :

```javascript
{
  id: 1,
  name: 'WBTC',
  address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  decimals: 8,
  purchaseAmount: '1000',  // ← Changez ici
  maxPurchases: 10,        // ← Et ici
  fee: 3000,
  enabled: true            // ← false pour désactiver
}
```

### Ajouter une nouvelle paire

1. Trouvez l'adresse du token sur [Arbiscan](https://arbiscan.io)
2. Ajoutez dans `PAIRS` :

```javascript
{
  id: 7,
  name: 'VOTRE_TOKEN',
  address: '0x...',        // Adresse du token
  decimals: 18,            // Nombre de décimales
  purchaseAmount: '500',
  maxPurchases: 10,
  fee: 3000,               // 3000 = 0.3%, 10000 = 1%
  enabled: true
}
```

### Changer le pourcentage de déclenchement

Via l'interface web : **Paramètres** → **% de baisse pour achat**

Ou dans le code (`server.js`), ligne ~15 :
```javascript
DROP_PERCENTAGE: 2,  // 2% de baisse
```

## 🔒 Sécurité

### ✅ Bonnes pratiques

- Ne partagez JAMAIS votre `.env` ou clé privée
- Ajoutez `.env` dans votre `.gitignore`
- Utilisez un wallet dédié au trading (pas votre wallet principal)
- Testez d'abord avec de petits montants
- Gardez toujours de l'ETH pour les frais de gas

### ⚠️ Limites de sécurité

Le bot inclut plusieurs protections :
- **Limite d'achats** par paire (MAX_PURCHASES)
- **Slippage protection** (1% par défaut)
- **Arrêt automatique** quand toutes les limites sont atteintes

## 💰 Coûts

### Frais de gas
- **~0.50-2$ par transaction** sur Arbitrum
- Dépend de la congestion du réseau

### Exemple de coût total
Si vous faites 10 achats sur 6 paires (60 transactions) :
- Frais estimés : 30-120$ en gas

## 🐛 Résolution de problèmes

### Le bot ne démarre pas

**"Configuration RPC_URL ou PRIVATE_KEY manquante"**
→ Vérifiez votre fichier `.env`

**"Insufficient funds"**
→ Ajoutez de l'ETH et de l'USDC sur votre wallet

### L'interface ne se charge pas

**Page blanche**
→ Vérifiez que `index.html` est bien dans le dossier `public/`

**"Failed to connect to server"**
→ Vérifiez que le serveur tourne sur le port 3000

### Erreurs de prix

**"Erreur prix"**
→ Vérifiez votre connexion RPC (Alchemy)
→ Le pool Uniswap pour ce token existe-t-il ?

### Erreurs de transaction

**"Slippage tolerance exceeded"**
→ Augmentez le slippage dans les paramètres (1% → 2%)

**"Transaction underpriced"**
→ Le réseau est congestionné, attendez quelques minutes

## 📚 API Endpoints

Le serveur expose plusieurs endpoints :

- `GET /api/config` - Récupérer la configuration
- `POST /api/config` - Mettre à jour la configuration
- `POST /api/start` - Démarrer le bot
- `POST /api/stop` - Arrêter le bot
- `GET /api/status` - Statut du bot
- `GET /api/pairs` - État des paires

### WebSocket Events

- `connect` - Connexion établie
- `log` - Nouveau log
- `status` - Mise à jour du statut
- `pairs-update` - Mise à jour des paires

## 🔄 Mise à jour

Pour mettre à jour les dépendances :

```bash
npm update
```

## 📝 Logs

Les logs sont affichés :
1. Dans l'interface web (section Journal d'activité)
2. Dans le terminal du serveur

Pour sauvegarder les logs dans un fichier, utilisez :

```bash
npm start > logs.txt 2>&1
```

## ⚡ Mode développement

Pour un rechargement automatique lors des modifications :

```bash
npm run dev
```

(Nécessite `nodemon` installé)

## 🎯 Stratégies recommandées

### Stratégie Conservative
- Montants faibles (100-300$)
- Beaucoup d'achats (15-20)
- Bon pour l'accumulation régulière

### Stratégie Agressive
- Montants élevés (1000-2000$)
- Peu d'achats (5-10)
- Capitalise sur les grosses baisses

### Stratégie Équilibrée
- Montants moyens (500$)
- Nombre moyen d'achats (10-15)
- Compromis entre les deux

## 📖 Ressources

- [Documentation Uniswap V3](https://docs.uniswap.org)
- [Arbiscan - Explorateur](https://arbiscan.io)
- [Alchemy - RPC Provider](https://alchemy.com)
- [Prix en temps réel - CoinGecko](https://www.coingecko.com)

## ⚠️ Avertissement

Ce bot est fourni à titre éducatif. Le trading comporte des risques :
- Vous pouvez perdre votre capital
- Les prix peuvent chuter fortement
- Les frais de gas s'accumulent
- Pas de garantie de profit

**Tradez de manière responsable et ne risquez que ce que vous pouvez vous permettre de perdre.**

## 📄 Licence

MIT

---

**💡 Besoin d'aide ?** Vérifiez que :
1. Node.js est bien installé (`node --version`)
2. Le fichier `.env` est correct
3. Vous avez de l'ETH et de l'USDC sur Arbitrum
4. Votre RPC Alchemy fonctionne

**🚀 Bon trading !**


# 🔄 Mise à jour : Pourcentage de déclenchement personnalisé par paire

## ✨ Nouveautés

Vous pouvez maintenant configurer un **pourcentage de baisse différent pour chaque paire** !

### Exemple d'utilisation

- **WBTC** : -2% (moins volatil, on attend une petite baisse)
- **SOL** : -5% (très volatil, on attend une grosse baisse)
- **LINK** : -3% (intermédiaire)

## 🎯 Ce qui a changé

### 1. Nouvelle configuration par paire

Chaque paire a maintenant son propre `dropPercentage` :

```javascript
{
  name: 'WBTC',
  purchaseAmount: '1000',
  maxPurchases: 10,
  dropPercentage: 2,  // ← NOUVEAU !
  enabled: true
}
```

### 2. Interface mise à jour

Dans chaque carte de paire, vous trouverez :
- Un nouveau champ **"% Baisse déclenchement"**
- Une explication visuelle de l'objectif
- Un indicateur 🎯 quand le seuil est atteint

### 3. Affichage amélioré

L'interface affiche maintenant :
- **Variation actuelle** : +2.5% ou -1.8%
- **Objectif personnel** : "Objectif: -2%"
- **Alerte visuelle** : 🎯 quand prêt à acheter
- **Code couleur** :
  - 🟢 Vert : Seuil atteint (va acheter)
  - 🟡 Jaune : En baisse mais pas encore au seuil
  - ⚪ Gris : En hausse

## 📝 Comment l'utiliser

### Via l'interface web

1. Ouvrez l'interface : `http://localhost:3000`
2. Pour chaque paire, modifiez le champ **"% Baisse déclenchement"**
3. Exemples de valeurs :
   - `1.0` = Très sensible (achète souvent)
   - `2.0` = Standard (recommandé)
   - `5.0` = Patient (attend les grosses baisses)
   - `10.0` = Très patient (crash uniquement)
4. Les changements sont automatiquement sauvegardés

### Via le code (server.js)

Modifiez directement dans `server.js` :

```javascript
let PAIRS = [
  {
    id: 1,
    name: 'WBTC',
    dropPercentage: 2,  // ← Changez ici
    // ...
  },
  {
    id: 2,
    name: 'WETH',
    dropPercentage: 3,  // Différent pour chaque paire !
    // ...
  }
];
```

## 💡 Stratégies recommandées

### Pour tokens stables (BTC, ETH)
```
dropPercentage: 1.5 - 2.5%
```
Ces tokens bougent moins, donc on peut se permettre d'acheter sur de petites baisses.

### Pour tokens volatils (SOL, AVAX, altcoins)
```
dropPercentage: 3 - 5%
```
Ces tokens peuvent facilement faire +/- 10% en une journée, donc on attend des baisses plus importantes.

### Pour traders très actifs
```
dropPercentage: 1 - 1.5%
```
⚠️ Attention : beaucoup de transactions = beaucoup de frais de gas !

### Pour traders patients
```
dropPercentage: 5 - 10%
```
Vous attendez les vraies corrections de marché.

## 🎨 Exemples visuels

### Exemple 1 : Configuration mixte
```javascript
WBTC: 2%   // Stable, achète souvent
WETH: 2%   // Stable, achète souvent
LINK: 3%   // Moyenne volatilité
SOL: 5%    // Très volatil, patient
AVAX: 4%   // Volatil
LDO: 3%    // Moyenne volatilité
```

### Exemple 2 : Tout très sensible (day trading)
```javascript
Toutes les paires: 1%
```
⚠️ Vous allez faire BEAUCOUP d'achats !

### Exemple 3 : Très patient (swing trading)
```javascript
Toutes les paires: 5-10%
```
Vous n'achèterez que lors de vraies corrections.

## 📊 Impact sur votre budget

### Avant (tous à 2%)
Si le marché baisse de 10%, vous ferez :
- 5 achats par paire × 6 paires = 30 transactions

### Après (personnalisé)
Avec WBTC à 2% et SOL à 5% :
- WBTC : 5 achats (tous les 2%)
- SOL : 2 achats (tous les 5%)
- Total : Moins de transactions = moins de fees !

## 🔒 Limitations

- **Minimum** : 0.1% (très très sensible)
- **Maximum** : 20% (attendre un crash)
- **Recommandé** : 1-5% selon votre stratégie
- ⚠️ Vous ne pouvez pas modifier pendant que le bot tourne

## 🐛 Résolution de problèmes

**"Le pourcentage ne s'affiche pas"**
→ Rechargez la page

**"Mes modifications ne sont pas sauvegardées"**
→ Vérifiez que le bot est bien arrêté avant de modifier

**"Le bot achète trop souvent"**
→ Augmentez le dropPercentage (ex: 2% → 3%)

**"Le bot n'achète jamais"**
→ Diminuez le dropPercentage (ex: 5% → 2%)

## 📈 Suivi des performances

L'interface affiche en temps réel :
- Variation actuelle vs objectif
- Nombre d'achats effectués
- Balance de chaque token

Vous pouvez ainsi ajuster vos pourcentages en fonction des résultats !

## 🎯 Conseil pro

Commencez avec des valeurs standard (2-3%) pour toutes les paires, puis ajustez progressivement en fonction de :
1. La volatilité observée de chaque token
2. Vos frais de gas cumulés
3. Votre stratégie d'investissement

---

**Bonne personnalisation ! 🚀**
