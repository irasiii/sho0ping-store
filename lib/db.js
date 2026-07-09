// Simple JSON-file database (no native dependencies, works everywhere).
// Data shape:
//   products:     [{ id, asin, title, brand, category, details, barcode, image, price, currency, stock, updatedAt }]
//   priceHistory: [{ productId, price, currency, at }]           -- every price, dated, old records kept
//   sales:        [{ productId, qty, price, at }]                -- every sale logged with date
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function load() {
  if (!fs.existsSync(DB_FILE)) {
    return { products: [], priceHistory: [], sales: [] };
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (!db.sales) db.sales = [];
  return db;
}

function save(db) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Insert or update a product. Records price history whenever the price changes
// (and on first insert). Old price records are always kept.
function upsertProduct(db, p) {
  const now = new Date().toISOString();
  let existing =
    (p.asin && db.products.find(x => x.asin === p.asin)) ||
    (p.barcode && db.products.find(x => x.barcode === p.barcode));

  if (existing) {
    const priceChanged = p.price != null && p.price !== existing.price;
    Object.assign(existing, p, { updatedAt: now });
    if (priceChanged) {
      db.priceHistory.push({ productId: existing.id, price: p.price, currency: p.currency || existing.currency || 'USD', at: now });
    }
    return existing;
  }

  const id = db.products.length ? Math.max(...db.products.map(x => x.id)) + 1 : 1;
  const product = { id, currency: 'USD', stock: 0, ...p, updatedAt: now };
  db.products.push(product);
  if (p.price != null) {
    db.priceHistory.push({ productId: id, price: p.price, currency: product.currency, at: now });
  }
  return product;
}

function findByBarcode(db, barcode) {
  const clean = String(barcode).replace(/\D/g, '');
  return db.products.find(p => {
    const b = String(p.barcode || '').replace(/\D/g, '');
    // match exact, or one is the other zero-padded (UPC-A vs EAN-13)
    return b && (b === clean || b.endsWith(clean) || clean.endsWith(b));
  });
}

function historyFor(db, productId) {
  return db.priceHistory
    .filter(h => h.productId === productId)
    .sort((a, b) => a.at.localeCompare(b.at));
}

// Record a sale: logs it with date + price and reduces stock.
function recordSale(db, productId, qty) {
  const p = db.products.find(x => x.id === productId);
  if (!p) return null;
  qty = Math.max(1, Number(qty) || 1);
  db.sales.push({ productId, qty, price: p.price, at: new Date().toISOString() });
  p.stock = Math.max(0, (p.stock || 0) - qty);
  p.updatedAt = new Date().toISOString();
  return p;
}

function soldFor(db, productId) {
  return db.sales.filter(s => s.productId === productId).reduce((n, s) => n + s.qty, 0);
}

module.exports = { load, save, upsertProduct, findByBarcode, historyFor, recordSale, soldFor };
