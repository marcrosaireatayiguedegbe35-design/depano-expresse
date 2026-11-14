// Fonction Vercel : délègue à l'application NestJS compilée (npm run build → dist/).
module.exports = require('../dist/serverless.js').default;
