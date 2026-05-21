/**
 * config.js — Unified configuration from .env
 * Replaces direct reads of scanner/config.json
 */
'use strict';

require('dotenv').config();

const config = {
  alpaca: {
    apiKey: process.env.ALPACA_API_KEY,
    secretKey: process.env.ALPACA_SECRET_KEY
  },
  r2: {
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || 'https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev'
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || 'newleaf-trading',
    databaseId: process.env.FIRESTORE_DATABASE_ID || 'newleafdb',
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json'
  },
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    from: process.env.EMAIL_FROM || 'NewLeaf Invest <marketing@newleafsystem.com>',
    recipients: (process.env.EMAIL_RECIPIENTS || '').split(',').filter(Boolean)
  },
  sentiment: {
    enabled: true,
    cacheMaxAgeMinutes: 360,
    engines: {
      claude: { enabled: true, weight: 0.30 },
      grok: { enabled: true, weight: 0.25, apiKey: process.env.SENTIMENT_GROK_API_KEY },
      gemini: { enabled: true, weight: 0.25, apiKey: process.env.SENTIMENT_GEMINI_API_KEY },
      reddit: { enabled: true, weight: 0.20 }
    }
  }
};

module.exports = config;
