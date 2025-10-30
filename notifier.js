const TelegramBot = require('node-telegram-bot-api');
const logger = require('./logger');
require('dotenv').config();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let bot;

if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
  logger.info('✅ Notificateur Telegram initialisé.');
} else {
  logger.warn('⚠️ Variables d\'environnement TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquantes. Les notifications Telegram ne seront pas envoyées.');
}

async function sendTelegramMessage(message) {
  if (!bot) {
    logger.warn('❌ Bot Telegram non initialisé. Impossible d\'envoyer le message.');
    return;
  }
  try {
    await bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'HTML' });
    logger.info('✉️ Message Telegram envoyé.');
  } catch (error) {
    logger.error('❌ Erreur envoi message Telegram:', error);
  }
}

module.exports = {
  sendTelegramMessage
};

