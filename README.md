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
