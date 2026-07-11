// Master seed: replaces the old phone catalog with the shoes + ladies bags
// catalog used by the store demo. Writes generated SVG product images into
// public/images and builds db.json. Run: `npm run seed`.
// NOTE: barcodes/prices here are SAMPLE data. Run `npm run sync` with real
// Amazon PA-API keys (see config.example.json) to replace with live data.
const db = require('./lib/db');

// Fresh start — drop any previous catalog (e.g. sample phones) so the store
// shows only the current shoes + bags inventory.
db.save({ products: [], priceHistory: [], sales: [] });

require('./seed-shoes');
require('./seed-bags');

console.log('Catalog seeded: shoes (Men/Women/Boys/Girls) + ladies bags.');
