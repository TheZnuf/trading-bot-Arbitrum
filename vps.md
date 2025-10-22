# 🚀 Déploiement sur VPS

## 📋 Prérequis

- Un VPS (Ubuntu 22.04 LTS recommandé)
- Accès SSH au VPS
- Nom de domaine (optionnel mais recommandé)

## 🛠️ Installation sur le VPS

### 1. Connexion SSH

```bash
ssh root@votre-ip-vps
# ou
ssh votre-user@votre-ip-vps
```

### 2. Installation de Node.js

```bash
# Installer Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Vérifier l'installation
node --version
npm --version
```

### 3. Installation de PM2 (gestionnaire de processus)

```bash
sudo npm install -g pm2
```

### 4. Télécharger le bot sur le VPS

**Option A : Via Git**
```bash
cd /home/votre-user
git clone votre-repo.git dca-bot
cd dca-bot
```

**Option B : Via SCP (depuis votre machine locale)**
```bash
# Sur votre machine locale
scp -r dca-bot/ votre-user@votre-ip:/home/votre-user/
```

**Option C : Créer manuellement**
```bash
mkdir dca-bot
cd dca-bot
nano server.js  # Collez le code
nano package.json
mkdir public
nano public/index.html
```

### 5. Installation des dépendances

```bash
cd dca-bot
npm install
```

### 6. Configuration du .env

```bash
nano .env
```

**Configuration pour VPS** :
```env
# Obligatoire
PRIVATE_KEY=votre_cle_privee
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/VOTRE_CLE

# Montants
AMOUNT_1=1000
AMOUNT_2=500

# Configuration serveur
PORT=3000
HOST=0.0.0.0
SERVER_URL=http://VOTRE_IP_VPS:3000

# Sécurité (optionnel)
CORS_ORIGIN=*
```

Remplacez `VOTRE_IP_VPS` par l'IP de votre serveur.

## 🚀 Lancer le bot avec PM2

### Démarrage

```bash
pm2 start server.js --name dca-bot
```

### Commandes utiles

```bash
# Voir les logs en temps réel
pm2 logs dca-bot

# Arrêter le bot
pm2 stop dca-bot

# Redémarrer le bot
pm2 restart dca-bot

# Supprimer le bot de PM2
pm2 delete dca-bot

# Voir le statut
pm2 status

# Sauvegarder la config PM2
pm2 save

# Démarrage automatique au boot
pm2 startup
# Suivez les instructions affichées
```

## 🔒 Configuration du pare-feu

### Avec UFW (Ubuntu)

```bash
# Autoriser SSH
sudo ufw allow 22

# Autoriser le port du bot
sudo ufw allow 3000

# Activer le firewall
sudo ufw enable

# Vérifier le statut
sudo ufw status
```

## 🌐 Accéder à l'interface

Une fois le bot lancé, accédez à :
```
http://VOTRE_IP_VPS:3000
```

## 🔐 Sécurisation avec un nom de domaine + HTTPS

### 1. Installer Nginx

```bash
sudo apt update
sudo apt install nginx
```

### 2. Configuration Nginx

```bash
sudo nano /etc/nginx/sites-available/dca-bot
```

**Configuration** :
```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Activer le site

```bash
sudo ln -s /etc/nginx/sites-available/dca-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Installer Certbot (HTTPS gratuit)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

### 5. Mettre à jour le .env

```env
SERVER_URL=https://votre-domaine.com
CORS_ORIGIN=https://votre-domaine.com
```

Redémarrez le bot :
```bash
pm2 restart dca-bot
```

## 📊 Surveillance et maintenance

### Logs en temps réel

```bash
pm2 logs dca-bot --lines 100
```

### Monitoring

```bash
pm2 monit
```

### Restart automatique en cas d'erreur

PM2 redémarre automatiquement le bot s'il crash.

### Mise à jour du bot

```bash
cd dca-bot
pm2 stop dca-bot
git pull  # Si vous utilisez Git
npm install
pm2 restart dca-bot
```

## 🔄 Sauvegarde

### Script de backup automatique

```bash
nano backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/votre-user/backups"

# Créer le dossier de backup
mkdir -p $BACKUP_DIR

# Backup du fichier d'état
cp /home/votre-user/dca-bot/bot-state.json $BACKUP_DIR/bot-state_$DATE.json

# Backup du .env
cp /home/votre-user/dca-bot/.env $BACKUP_DIR/.env_$DATE

# Garder seulement les 30 derniers backups
cd $BACKUP_DIR
ls -t | tail -n +31 | xargs rm -f

echo "Backup effectué: $DATE"
```

```bash
chmod +x backup.sh

# Ajouter au cron (backup quotidien à 3h)
crontab -e
# Ajoutez:
0 3 * * * /home/votre-user/backup.sh
```

## 📱 Accès depuis votre téléphone

Ouvrez simplement dans le navigateur :
```
https://votre-domaine.com
```

Ou :
```
http://VOTRE_IP_VPS:3000
```

## 🔐 Sécurité avancée

### 1. Authentification basique avec Nginx

```nginx
server {
    # ... config existante ...
    
    auth_basic "DCA Bot Admin";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

Créer le fichier de mot de passe :
```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd admin
# Entrez un mot de passe
sudo systemctl restart nginx
```

### 2. Limiter l'accès par IP

```nginx
location / {
    allow VOTRE_IP;
    deny all;
    # ... reste de la config
}
```

### 3. Fail2ban pour SSH

```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## ⚠️ Checklist de sécurité

```
☐ Firewall configuré (UFW)
☐ Clé SSH utilisée (pas de mot de passe)
☐ .env avec permissions 600
☐ HTTPS activé (Certbot)
☐ Backups automatiques configurés
☐ PM2 configuré pour redémarrage auto
☐ Mot de passe fort sur Nginx (optionnel)
☐ Fail2ban installé
☐ Mises à jour système régulières
```

## 🆘 Dépannage VPS

### Le bot ne démarre pas

```bash
# Vérifier les logs
pm2 logs dca-bot

# Vérifier si le port est utilisé
sudo lsof -i :3000

# Redémarrer
pm2 restart dca-bot
```

### Erreur de connexion WebSocket

```bash
# Vérifier que Nginx proxy les WebSockets
sudo nginx -t
sudo systemctl restart nginx

# Vérifier le firewall
sudo ufw status
```

### Manque de mémoire

```bash
# Vérifier la mémoire
free -h

# Redémarrer PM2
pm2 restart all
```

### Bot lent ou freeze

```bash
# Vérifier les ressources
htop

# Logs
pm2 logs dca-bot --lines 1000
```

## 📈 Optimisations VPS

### 1. Augmenter la limite de fichiers ouverts

```bash
sudo nano /etc/security/limits.conf
# Ajoutez:
* soft nofile 65536
* hard nofile 65536
```

### 2. Swap (si peu de RAM)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 💡 Recommandations VPS

### Fournisseurs recommandés

- **DigitalOcean** : $6/mois - Simple et fiable
- **Hetzner** : €4/mois - Excellent rapport qualité/prix
- **Vultr** : $6/mois - Bonnes performances
- **Contabo** : €5/mois - Pas cher

### Configuration minimale

- **CPU** : 1 vCPU
- **RAM** : 1 GB (2 GB recommandé)
- **Stockage** : 25 GB
- **Bande passante** : Illimitée ou 1TB+

## 🎯 Résumé des URLs

**Local** :
```
http://localhost:3000
```

**VPS sans domaine** :
```
http://123.45.67.89:3000
```

**VPS avec domaine** :
```
https://bot.mondomaine.com
```

## 📝 Template .env pour VPS

```env
# === BLOCKCHAIN ===
PRIVATE_KEY=0xvotre_cle_privee
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/VOTRE_CLE

# === MONTANTS ===
AMOUNT_1=1000
AMOUNT_2=500

# === SERVEUR ===
PORT=3000
HOST=0.0.0.0
SERVER_URL=https://bot.mondomaine.com

# === SÉCURITÉ ===
CORS_ORIGIN=https://bot.mondomaine.com
```

---

**Votre bot est maintenant accessible 24/7 depuis n'importe où ! 🌍**
