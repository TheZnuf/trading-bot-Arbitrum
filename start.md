# 🚀 Guide de démarrage rapide

## ✅ Modifications récentes

### 1. Bouton "Paramètres" supprimé
Le bouton n'était pas pertinent car les paramètres sensibles (RPC, clé privée) doivent être dans le fichier `.env` pour des raisons de sécurité.

**Configuration :** Modifiez le fichier `.env` puis redémarrez le serveur.

### 2. ATH (All-Time High) maintenant visible
L'interface affiche maintenant :
- 🔥 **ATH** : Prix le plus haut depuis le dernier achat
- **Variation depuis ATH** : En % et en couleur
- **Prix actuel** et **dernier achat** pour référence

## 📋 Checklist avant de démarrer

```
☐ Node.js installé (v18+)
☐ Fichier .env créé avec RPC_URL et PRIVATE_KEY
☐ ETH sur Arbitrum pour les frais de gas (~10$)
☐ USDC sur Arbitrum pour les achats
☐ npm install exécuté
```

## ⚡ Démarrage en 3 étapes

### Étape 1 : Configuration du .env

Créez un fichier `.env` à la racine :

```env
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/VOTRE_CLE
PRIVATE_KEY=0xvotre_cle_privee_metamask
PORT=3000
```

### Étape 2 : Lancer le serveur

```bash
npm start
```

Vous devriez voir :
```
🚀 Serveur démarré sur http://localhost:3000
📡 WebSocket disponible sur ws://localhost:3000
```

### Étape 3 : Ouvrir l'interface

Dans votre navigateur : **http://localhost:3000**

## 🎮 Utilisation de l'interface

### Vue d'ensemble

```
┌─────────────────────────────────────────────┐
│ 🤖 DCA Bot Manager                          │
│                                    [Démarrer]│
├─────────────────────────────────────────────┤
│ Stats : Budget | Paires | Achats | Statut  │
├─────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │  WBTC   │ │  WETH   │ │  LINK   │        │
│ │  [ON]   │ │  [ON]   │ │  [OFF]  │        │
│ │ Prix    │ │ Prix    │ │ Prix    │        │
│ │ 🔥 ATH  │ │ 🔥 ATH  │ │ 🔥 ATH  │        │
│ │ -2.5%   │ │ +1.2%   │ │ 0%      │        │
│ └─────────┘ └─────────┘ └─────────┘        │
├─────────────────────────────────────────────┤
│ 📋 Journal d'activité                       │
│ [10:30] ✅ Bot démarré                      │
│ [10:31] 🔄 Vérification des prix...        │
└─────────────────────────────────────────────┘
```

### Pour chaque paire

**Bouton ON/OFF** : Activer/désactiver la paire

**Prix actuel** : Prix en temps réel

**🔥 ATH** : Prix le plus haut depuis le dernier achat
- Se met à jour automatiquement
- Se réinitialise à chaque achat

**Variation depuis ATH** :
- 🟢 Vert : Baisse ≥ objectif → Prêt à acheter !
- 🟡 Jaune : Baisse < objectif → En surveillance
- ⚪ Gris : En hausse

**Configuration modifiable** :
- Montant (USDC) : Montant par achat
- Max Achats : Nombre maximum d'achats
- % Baisse : Pourcentage de baisse depuis ATH pour déclencher

## 🎯 Comprendre l'ATH

### Exemple 1 : Marché haussier avec correction

```
Timeline du prix BTC :

10:00  │  $45,000  →  Achat #1, ATH = $45,000
10:30  │  $46,000  →  ATH = $46,000 🔥 (+2.2%)
11:00  │  $47,000  →  ATH = $47,000 🔥 (+4.4%)
11:30  │  $46,500  →  ATH reste $47,000 (-1.1% depuis ATH)
12:00  │  $46,000  →  ATH reste $47,000 (-2.1% depuis ATH) 🎯
       └─→ ACHAT déclenché !

Nouveau cycle : ATH = $46,000
```

### Exemple 2 : Marché volatil

```
Timeline du prix ETH :

09:00  │  $3,000  →  Achat #1, ATH = $3,000
09:30  │  $3,060  →  ATH = $3,060 🔥 (+2%)
10:00  │  $3,000  →  ATH reste $3,060 (-2% depuis ATH) 🎯
       └─→ ACHAT déclenché !

Avantage : On a acheté après une correction, 
pas au même prix que l'achat précédent !
```

## 🔧 Modification de la configuration

### Changer les montants par paire

**Depuis l'interface** (bot arrêté) :
1. Modifiez les champs dans chaque carte
2. Les changements sont sauvegardés automatiquement

**Depuis le code** (server.js, ligne ~30) :
```javascript
{
  name: 'WBTC',
  purchaseAmount: '1000',    // ← Changez ici
  maxPurchases: 10,          // ← Et ici
  dropPercentage: 2,         // ← Et ici
  enabled: true
}
```

### Changer les paramètres globaux

**Fichier .env** :
```env
ARBITRUM_RPC_URL=...
PRIVATE_KEY=...
```

**Fichier server.js** (ligne ~15) :
```javascript
const CONFIG = {
  DROP_PERCENTAGE: 2,        // % global (si non défini par paire)
  CHECK_INTERVAL: 60000,     // Vérification toutes les 60s
  SLIPPAGE_TOLERANCE: 1,     // Slippage 1%
  ...
};
```

Après modification : **Redémarrez le serveur** (`Ctrl+C` puis `npm start`)

## 📊 Lecture des statistiques

### En-tête

- **Budget Total Max** : Somme maximale qui peut être dépensée
- **Paires Actives** : Nombre de paires avec ON
- **Achats Effectués** : Total d'achats réalisés
- **Statut** : Bot actif ou arrêté

### Journal d'activité

Types de messages :
- 🟢 Vert : Succès (achat confirmé, connexion OK)
- 🔴 Rouge : Erreur (transaction échouée, problème RPC)
- ⚪ Gris : Info (vérification prix, nouveau ATH)

## ⚠️ Vérifications importantes

### Avant le premier démarrage

```bash
# 1. Vérifier les dépendances
npm list

# 2. Vérifier le .env
cat .env  # (Linux/Mac)
type .env # (Windows)

# 3. Vérifier les balances
# Via MetaMask ou Arbiscan
```

### Pendant l'utilisation

- ✅ Surveillez le journal d'activité
- ✅ Vérifiez les ATH qui se mettent à jour
- ✅ Surveillez votre balance USDC
- ✅ Gardez assez d'ETH pour les fees

## 🐛 Résolution rapide

**Le bot ne démarre pas**
```
→ Vérifiez le .env
→ Vérifiez que le port 3000 est libre
→ Relancez : npm start
```

**L'ATH ne s'affiche pas**
```
→ Actualisez la page (F5)
→ Le bot doit avoir fait au moins un achat
→ Vérifiez la console du navigateur (F12)
```

**"Configuration manquante"**
```
→ Créez le fichier .env
→ Ajoutez ARBITRUM_RPC_URL et PRIVATE_KEY
→ Redémarrez : npm start
```

**Aucun prix affiché**
```
→ Vérifiez votre RPC Alchemy
→ Attendez 1 minute (premier check)
→ Regardez les logs du serveur
```

## 💡 Conseils pro

1. **Commencez petit** : Testez avec 10-50$ par achat
2. **Une paire à la fois** : Désactivez les autres pour comprendre
3. **Suivez l'ATH** : C'est votre indicateur principal
4. **Patience** : Les achats peuvent prendre du temps selon la volatilité
5. **Logs = vérité** : Tout est logé, regardez-les !

## 🎓 Stratégies recommandées

### Conservative (débutant)
```
Montants : 100-300$ par paire
% Baisse : 1.5-2%
Max achats : 15-20
```

### Équilibrée (intermédiaire)
```
Montants : 500-1000$ par paire
% Baisse : 2-3%
Max achats : 10-15
```

### Agressive (avancé)
```
Montants : 1000-2000$ par paire
% Baisse : 3-5%
Max achats : 5-10
```

---

**Vous êtes prêt ! Lancez avec `npm start` et ouvrez http://localhost:3000 🚀**
