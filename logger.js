const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'trading-bot' },
  transports: [
    //
    // - Écrire tous les logs de niveau `info` et inférieur dans `app.log`
    // - Écrire tous les logs de niveau `error` et inférieur dans `error.log`
    //
    new winston.transports.File({ filename: path.join(__dirname, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(__dirname, 'app.log') })
  ]
});

//
// Si nous ne sommes pas en production, alors logger aussi dans la console
// avec un format plus simple et coloré.
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
