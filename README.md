# Bot de Trading DCA Multi-Paires pour Arbitrum

Ce bot de trading implémente une stratégie de **Dollar Cost Averaging (DCA)** pour plusieurs paires de tokens sur le réseau Arbitrum. Il est conçu pour être robuste, configurable et facile à surveiller grâce à une interface web intégrée et des notifications Telegram.

## 🚀 Fonctionnalités

- **Stratégie DCA** : Achète automatiquement des montants fixes d'un token lorsque son prix chute d'un certain pourcentage par rapport à son dernier point le plus haut (ATH depuis le dernier achat).
- **Multi-Paires** : Gérez et tradez plusieurs paires de tokens simultanément.
- **Configuration Flexible** : La configuration des paires est externalisée dans un fichier `pairs.json`, la rendant facile à modifier sans toucher au code.
- **Interface Web** : Une interface web simple pour démarrer/arrêter le bot, surveiller les prix, les achats, les balances et les logs en temps réel.
- **Persistance de l'État** : Le bot sauvegarde son état (derniers achats, ATH, etc.) dans un fichier `bot-state.json`, lui permettant de redémarrer sans perdre sa progression.
- **Calculs de Haute Précision** : Utilise `BigInt` pour tous les calculs financiers afin d'éviter les erreurs d'arrondi.
- **Logging Avancé** : Enregistre les logs dans des fichiers (`app.log`, `error.log`) pour un débogage et un suivi faciles.
- **Notifications Telegram** : Recevez des alertes en temps réel pour les achats, les ventes et les erreurs directement sur votre compte Telegram.

---

## 🛠️ Installation

### Prérequis

- [Node.js](https://nodejs.org/) (version 18 ou supérieure)
- Un wallet Ethereum avec des fonds (USDC et un peu d'ETH pour le gaz) sur le réseau Arbitrum.
- Un point d'accès RPC pour Arbitrum (ex: [Alchemy](https://www.alchemy.com/) ou [Infura](https://www.infura.io/)).

### Étapes

1.  **Cloner le projet** (si ce n'est pas déjà fait) :
    ```bash
    git clone <url_du_repository>
    cd trading-bot-Arbitrum
    ```

2.  **Installer les dépendances** :
    ```bash
    npm install
    ```

3.  **Configurer l'environnement** :
    -   Copiez le fichier d'exemple `.env.exemple` et renommez-le en `.env`.
    -   Ouvrez le fichier `.env` et remplissez les variables :

    | Variable               | Description                                                                                                                            |
    | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
    | `PRIVATE_KEY`          | **[CRUCIAL]** La clé privée de votre wallet. **NE JAMAIS LA PARTAGER.**                                                                 |
    | `ARBITRUM_RPC_URL`     | L'URL de votre point d'accès RPC pour le réseau Arbitrum.                                                                              |
    | `PORT`                 | (Optionnel) Le port sur lequel l'interface web tournera (par défaut `3000`).                                                           |
    | `AMOUNT_1`             | Le montant en USDC pour les achats de tokens de catégorie 1 (ex: WBTC, WETH).                                                          |
    | `AMOUNT_2`             | Le montant en USDC pour les achats de tokens de catégorie 2 (ex: altcoins).                                                            |
    | `TELEGRAM_BOT_TOKEN`   | (Optionnel) Le token de votre bot Telegram pour les notifications.                                                                     |
    | `TELEGRAM_CHAT_ID`     | (Optionnel) L'ID de la conversation Telegram où envoyer les notifications.                                                             |

---

## ⚙️ Configuration

### Configuration des Paires

Le fichier `pairs.json` contient la liste des tokens que le bot doit surveiller. Vous pouvez ajouter, modifier ou supprimer des objets dans ce tableau.

**Exemple d'une paire :**
```json
{
  "id": 1,
  "name": "WBTC",
  "address": "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
  "decimals": 8,
  "purchaseAmountKey": "AMOUNT_1",
  "maxPurchases": 10,
  "dropPercentage": 2,
  "fee": 3000,
  "enabled": true,
  "category": 1
}
```

| Clé                 | Description                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `id`                | Un identifiant unique pour la paire.                                                                    |
| `name`              | Le nom du token (pour l'affichage).                                                                     |
| `address`           | L'adresse du contrat du token sur Arbitrum.                                                             |
| `decimals`          | Le nombre de décimales du token.                                                                        |
| `purchaseAmountKey` | La clé (`AMOUNT_1` ou `AMOUNT_2`) à utiliser depuis le fichier `.env` pour déterminer le montant d'achat. |
| `maxPurchases`      | Le nombre maximum d'achats à effectuer pour cette paire.                                                |
| `dropPercentage`    | Le pourcentage de baisse requis depuis l'ATH pour déclencher un nouvel achat.                           |
| `fee`               | Les frais du pool Uniswap V3 (ex: `500` pour 0.05%, `3000` pour 0.3%).                                   |
| `enabled`           | Mettez à `true` pour activer le trading pour cette paire, `false` pour la désactiver.                   |
| `category`          | Une catégorie numérique (1 ou 2) pour l'organisation.                                                   |

### Configuration des Notifications Telegram

1.  **Créez un bot Telegram** :
    -   Sur Telegram, parlez au bot `@BotFather`.
    -   Envoyez la commande `/newbot` et suivez les instructions.
    -   BotFather vous donnera un **token**. Copiez-le dans la variable `TELEGRAM_BOT_TOKEN` de votre fichier `.env`.

2.  **Obtenez votre Chat ID** :
    -   Démarrez une conversation avec le bot que vous venez de créer.
    -   Envoyez-lui un message (n'importe quoi).
    -   Ouvrez votre navigateur et allez à l'URL suivante, en remplaçant `<YOUR_BOT_TOKEN>` par votre token :
        `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
    -   Dans la réponse JSON, trouvez `"chat":{"id":...}`. Le nombre qui suit est votre **Chat ID**. Copiez-le dans la variable `TELEGRAM_CHAT_ID` de votre fichier `.env`.

---

## ▶️ Utilisation

1.  **Démarrer le serveur** :
    ```bash
    node server.js
    ```

2.  **Ouvrir l'interface web** :
    -   Ouvrez votre navigateur et allez à l'adresse `http://localhost:3000` (ou le port que vous avez configuré).

3.  **Contrôler le bot** :
    -   Cliquez sur le bouton **"Démarrer le Bot"** pour lancer la surveillance et le trading.
    -   Les logs, l'état des paires et les informations du wallet s'afficheront en temps réel.
    -   Cliquez sur **"Arrêter le Bot"** pour mettre en pause le processus.

---

## ⚠️ Avertissement de Sécurité

-   La gestion de clés privées est extrêmement sensible. La clé stockée dans le fichier `.env` donne un contrôle total sur votre wallet.
-   Assurez-vous que le serveur exécutant ce bot est sécurisé.
-   **N'exposez jamais votre fichier `.env` ou votre clé privée.** Assurez-vous que `.env` est bien listé dans votre fichier `.gitignore`.
-   Ce bot est fourni à des fins éducatives. L'utilisation de ce bot est à vos propres risques.