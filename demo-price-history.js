// Demo: simulates two months of Amazon price checks for 3 store items.
// Each check that found a different price created a NEW dated record;
// all old records are kept. Run: node demo-price-history.js
const db = require('./lib/db');

const demo = [
  { barcode: '195949048586', prices: [1199.00, 1179.00, 1149.99, 1099.00, 1129.00] }, // iPhone 15 Pro Max
  { barcode: '887276794709', prices: [1299.99, 1249.99, 1199.99, 1149.99, 1189.99] }, // Galaxy S24 Ultra
  { barcode: '840244705824', prices: [999.00, 949.00, 899.00, 849.00, 879.00] }        // Pixel 8 Pro
];

const d = db.load();
const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

for (const item of demo) {
  const p = db.findByBarcode(d, item.barcode);
  if (!p) { console.log('not found:', item.barcode); continue; }
  // remove old records for a clean demo, then write one record every ~2 weeks
  d.priceHistory = d.priceHistory.filter(h => h.productId !== p.id);
  item.prices.forEach((price, i) => {
    const at = new Date(now - (item.prices.length - 1 - i) * 14 * DAY).toISOString();
    d.priceHistory.push({ productId: p.id, price, currency: 'USD', at });
  });
  p.price = item.prices[item.prices.length - 1]; // current = newest record
  p.updatedAt = new Date().toISOString();
  console.log(`${p.title}: ${item.prices.length} dated price records, current $${p.price}`);
}

db.save(d);
console.log('Done — open any of these items to see the price history.');
