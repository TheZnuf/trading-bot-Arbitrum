# 💾 Sauvegarde de l'état du bot

## ✨ Nouveauté : Persistence automatique

Le bot sauvegarde maintenant automatiquement son état dans un fichier `bot-state.json`.

## 📝 Ce qui est sauvegardé

Pour chaque paire :
- **Nombre d'achats effectués** (purchaseCount)
- **Prix du dernier achat** (lastPurchasePrice)
- **ATH actuel** (All-Time High depuis le dernier achat)
- **Timestamp de la dernière sauvegarde**

## 🔄 Quand la sauvegarde se fait

La sauvegarde est **automatique** et se déclenche :
- ✅ Après chaque achat réussi
- ✅ Immédiatement (pas de délai)
- ✅ Dans le fichier `bot-state.json` à la racine

## 📂 Exemple de fichier bot-state.json

```json
{
  "timestamp": "2025-10-16T14:30:45.123Z",
  "pairs": [
    {
      "id": 1,
      "name": "WBTC",
      "lastPurchasePrice": 45234.50,
      "ath": 46200.00,
      "purchaseCount": 3
    },
    {
      "id": 2,
      "name": "WETH",
      "lastPurchasePrice": 3124.80,
      "ath": 3180.50,
      "purchaseCount": 2
    }
  ]
}
```

## 🚀 Restauration au démarrage

Quand vous **redémarrez le bot** :

1. Le bot lit automatiquement `bot-state.json`
2. Restaure l'état de chaque paire
3. Continue là où il s'était arrêté !

### Exemple de logs au démarrage

```
✅ Connexion établie: 0x1234...5678
💰 Balance USDC: 10000.00
📂 État chargé depuis: 2025-10-16T14:30:45.123Z
📂 [WBTC] État restauré: 3 achats, ATH: 46200.00
📂 [WETH] État restauré: 2 achats, ATH: 3180.50
🚀 Bot initialisé avec 6 paires actives
```

## ✅ Avantages

### 1. Continuité
```
Avant (sans sauvegarde):
- Redémarrage → Tout est perdu
- Le bot recommence à 0
- ATH réinitialisé

Après (avec sauvegarde):
- Redémarrage → État restauré ✅
- Le bot continue normalement
- ATH conservé
```

### 2. Tracking précis
- Vous savez exactement combien d'achats ont été faits
- L'ATH reste correct même après redémarrage
- Pas de risque d'acheter en double

### 3. Sécurité
- Crash du serveur → État préservé
- Redémarrage machine → Rien n'est perdu
- Mise à jour code → Historique intact

## 📊 Scénario d'utilisation

### Jour 1 - 10h00
```
[WBTC] Premier achat à 45,000$
💾 État sauvegardé
```

### Jour 1 - 14h00
```
[WBTC] ATH mis à jour: 46,500$
[WBTC] Prix actuel: 45,500$ (-2.15%)
[WBTC] Achat #2 déclenché
💾 État sauvegardé
```

### Jour 1 - 18h00
```
💡 Vous arrêtez le serveur pour mise à jour
Ctrl+C
```

### Jour 2 - 9h00
```
npm start
📂 État chargé depuis: 2025-10-16T14:00:00.000Z
📂 [WBTC] État restauré: 2 achats, ATH: 45500.00
▶️ Le bot reprend là où il s'était arrêté !
```

## 🔍 Vérifier le fichier de sauvegarde

### Lire le fichier
```bash
# Linux/Mac
cat bot-state.json

# Windows
type bot-state.json

# Ou ouvrez-le simplement dans un éditeur de texte
```

### Structure attendue
```json
{
  "timestamp": "...",  // Date de la dernière sauvegarde
  "pairs": [           // Tableau de toutes les paires
    {
      "id": 1,
      "name": "WBTC",
      "lastPurchasePrice": 45000,  // Peut être null si aucun achat
      "ath": 46500,                 // Peut être null si aucun achat
      "purchaseCount": 2            // Toujours >= 0
    }
  ]
}
```

## ⚠️ Situations particulières

### Première utilisation
```
Pas de bot-state.json → Normal
Le fichier sera créé au premier achat
Tous les compteurs démarrent à 0
```

### Fichier corrompu
```
❌ Erreur chargement état: Unexpected token...
→ Le bot démarre quand même
→ Un nouveau fichier sera créé
→ Vous pouvez restaurer manuellement (voir ci-dessous)
```

### Changement de configuration
```
Si vous modifiez les paires dans server.js:
- L'état des paires existantes est conservé
- Les nouvelles paires démarrent à 0
- Les paires supprimées sont ignorées
```

## 🛠️ Gestion manuelle

### Réinitialiser une paire

Éditez `bot-state.json` et mettez :
```json
{
  "id": 1,
  "name": "WBTC",
  "lastPurchasePrice": null,
  "ath": null,
  "purchaseCount": 0
}
```

### Réinitialiser tout

```bash
# Supprimez le fichier
rm bot-state.json

# Redémarrez le bot
npm start

# Un nouveau fichier vierge sera créé
```

### Backup de l'état

```bash
# Faire une copie de sauvegarde
cp bot-state.json bot-state-backup.json

# Restaurer depuis un backup
cp bot-state-backup.json bot-state.json
```

## 📈 Cas d'usage avancés

### Export pour analyse

Le fichier JSON peut être facilement importé dans :
- Excel/Google Sheets
- Python (pandas)
- Outils d'analyse

```python
# Exemple Python
import json

with open('bot-state.json') as f:
    data = json.load(f)
    
for pair in data['pairs']:
    print(f"{pair['name']}: {pair['purchaseCount']} achats")
```

### Migration vers un autre serveur

```bash
# Sur l'ancien serveur
scp bot-state.json user@nouveau-serveur:/chemin/dca-bot/

# Sur le nouveau serveur
npm start
# L'état est restauré automatiquement !
```

## 🔒 Sécurité

### Le fichier est dans .gitignore
```
✅ bot-state.json ne sera pas commit sur Git
✅ Votre historique d'achats reste privé
✅ Pas de risque de partager des infos sensibles
```

### Permissions du fichier
```bash
# Vérifier les permissions (Linux/Mac)
ls -la bot-state.json

# Devrait être lisible uniquement par vous
-rw------- 1 user user 450 Oct 16 14:30 bot-state.json
```

## 📝 Logs de sauvegarde

Dans le terminal du serveur, vous verrez :
```
💾 État sauvegardé
```

Après chaque achat. Si ce message n'apparaît pas :
- Vérifiez les permissions d'écriture du dossier
- Regardez s'il y a des erreurs dans les logs

## ❓ FAQ

**Q: Le fichier bot-state.json prend-il beaucoup de place ?**
R: Non, ~500 octets pour 6 paires. Négligeable.

**Q: Puis-je éditer le fichier manuellement ?**
R: Oui, mais arrêtez le bot d'abord. Respectez la structure JSON.

**Q: Que se passe-t-il si je supprime le fichier pendant que le bot tourne ?**
R: Aucun problème. Il sera recréé au prochain achat.

**Q: L'état est-il sauvegardé en temps réel ?**
R: Après chaque achat uniquement. Pas besoin de plus.

**Q: Puis-je avoir plusieurs fichiers de sauvegarde ?**
R: Oui, copiez bot-state.json sous un autre nom pour faire des backups.

## 🎯 Résumé

```
✅ Sauvegarde automatique après chaque achat
✅ Restauration automatique au démarrage
✅ Fichier JSON lisible et éditable
✅ Dans .gitignore pour la sécurité
✅ Léger et rapide
✅ Aucune configuration nécessaire

→ Ça marche tout seul ! 💾
```

---

**Votre bot garde maintenant la mémoire ! 🧠**
