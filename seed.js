// Master seed: replaces the old phone catalog with the shoes + ladies bags +
// accessories catalog used by the store demo. Writes generated SVG product
// images into public/images and builds db.json. Run: `npm run seed`.
// NOTE: barcodes/prices here are SAMPLE data. Run `npm run sync` with real
// Amazon PA-API keys (see config.example.json) to replace with live data.
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');

// Fresh start — drop any previous catalog (e.g. sample phones) so the store
// shows only the current shoes + bags + accessories inventory.
db.save({ products: [], priceHistory: [], sales: [] });

// Remove previously downloaded photos so fetch-images re-downloads them with
// the correct category mapping (otherwise unchanged filenames would be skipped).
const imgDir = path.join(__dirname, 'public', 'images');
if (fs.existsSync(imgDir)) {
  for (const f of fs.readdirSync(imgDir)) {
    if (f.startsWith('real-')) fs.unlinkSync(path.join(imgDir, f));
  }
}

require('./seed-shoes');
require('./seed-bags');
require('./seed-accessories');
require('./fetch-images'); // swap SVG placeholders for real community photos

console.log('Catalog seeded: shoes + ladies bags + accessories, with real photos.');
