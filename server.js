const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./lib/db');
const vision = require('./lib/vision');
const clip = require('./lib/clip');
const claude = require('./lib/claude');
const amazon = require('./lib/amazon');
const auth = require('./lib/auth');
const gemini = require('./lib/gemini');


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- Users & login ----
app.post('/api/login', (req, res) => {
  const r = auth.checkLogin(req.body && req.body.username, req.body && req.body.password);
  if (!r) return res.status(401).json({ error: 'Wrong username or password.' });
  res.setHeader('Set-Cookie', `sid=${r.sid}; HttpOnly; Path=/; SameSite=Lax`);
  res.json({ username: r.username, role: r.role });
});

app.post('/api/logout', (req, res) => {
  auth.logout(req);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const u = auth.fromRequest(req);
  if (!u) return res.status(401).json({ error: 'not logged in' });
  res.json(u);
});

app.get('/api/users', auth.requireAdmin, (req, res) => res.json(auth.listUsers()));

app.post('/api/users', auth.requireAdmin, (req, res) => {
  try {
    res.json(auth.addUser(req.body.username, req.body.password, req.body.role));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// discount % from MSRP vs current sale price
function withDiscount(p) {
  const disc = p.msrp && p.msrp > p.price ? Math.round((1 - p.price / p.msrp) * 100) : 0;
  return { ...p, discount: disc };
}

// List all products (with current price), optional text filter
app.get('/api/products', (req, res) => {
  const d = db.load();
  let items = d.products;
  const q = (req.query.q || '').toLowerCase();
  if (q) {
    items = items.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q) ||
      String(p.barcode || '').includes(q)
    );
  }
  res.json(items.map(withDiscount));
});

// Product detail + price history
app.get('/api/products/:id', (req, res) => {
  const d = db.load();
  const p = d.products.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json({ ...withDiscount(p), history: db.historyFor(d, p.id) });
});

// Look up by barcode (from camera scan or photo)
app.get('/api/barcode/:code', (req, res) => {
  const d = db.load();
  const p = db.findByBarcode(d, req.params.code);
  if (!p) return res.status(404).json({ error: 'No product with this barcode', barcode: req.params.code });
  res.json({ ...withDiscount(p), history: db.historyFor(d, p.id) });
});

// Add/update a product manually (admin)
app.post('/api/products', auth.requireAdmin, (req, res) => {
  const { title, barcode, price } = req.body || {};
  if (!title || !barcode || price == null) {
    return res.status(400).json({ error: 'title, barcode and price are required' });
  }
  const d = db.load();
  const fields = {
    title,
    barcode: String(barcode),
    price: Number(price),
    currency: req.body.currency || 'USD'
  };
  // only set optional fields when provided, so updates never blank them
  for (const k of ['brand', 'image', 'asin', 'category', 'details', 'sku', 'description', 'msrp', 'material', 'weight', 'supplier', 'status']) {
    if (req.body[k]) fields[k] = req.body[k];
  }
  if (req.body.stock != null) fields.stock = Number(req.body.stock);
  if (req.body.cost != null) fields.cost = Number(req.body.cost);
  const p = db.upsertProduct(d, fields);
  db.save(d);
  res.json(p);
});

// Record a new price for an existing product (keeps history)
app.post('/api/products/:id/price', auth.requireAdmin, (req, res) => {
  const d = db.load();
  const p = d.products.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Not found' });
  const price = Number(req.body && req.body.price);
  if (!price) return res.status(400).json({ error: 'price is required' });
  db.upsertProduct(d, { ...p, price });
  db.save(d);
  res.json({ ...p, price, history: db.historyFor(d, p.id) });
});

// Record a sale (logs date+price, reduces stock)
app.post('/api/products/:id/sell', auth.requireAdmin, (req, res) => {
  const d = db.load();
  const p = db.recordSale(d, Number(req.params.id), req.body && req.body.qty);
  if (!p) return res.status(404).json({ error: 'Not found' });
  db.save(d);
  res.json({ ...p, sold: db.soldFor(d, p.id) });
});

// Set stock level
app.post('/api/products/:id/stock', auth.requireAdmin, (req, res) => {
  const d = db.load();
  const p = d.products.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.stock = Math.max(0, Number(req.body && req.body.stock) || 0);
  p.updatedAt = new Date().toISOString();
  db.save(d);
  res.json(p);
});

// Store movement report: price changes, sales, stock left
app.get('/api/report', auth.requireAdmin, (req, res) => {
  const d = db.load();
  const priceChanges = [];
  for (const p of d.products) {
    const h = db.historyFor(d, p.id);
    for (let i = 1; i < h.length; i++) {
      priceChanges.push({ productId: p.id, title: p.title, category: p.category || '', from: h[i - 1].price, to: h[i].price, at: h[i].at });
    }
  }
  priceChanges.sort((a, b) => b.at.localeCompare(a.at));

  const sales = [...d.sales].sort((a, b) => b.at.localeCompare(a.at)).map(x => ({
    ...x, title: (d.products.find(p => p.id === x.productId) || {}).title || ('#' + x.productId)
  }));

  const items = d.products.map(p => ({
    id: p.id, title: p.title, category: p.category || '', barcode: p.barcode, sku: p.sku || '',
    price: p.price, msrp: p.msrp || null, stock: p.stock || 0, sold: db.soldFor(d, p.id),
    cost: p.cost || null, asin: p.asin || '',
    image: p.image || '', imageFallback: p.imageFallback || ''
  }));

  res.json({
    totals: {
      items: items.length,
      stockUnits: items.reduce((n, x) => n + x.stock, 0),
      soldUnits: items.reduce((n, x) => n + x.sold, 0),
      revenue: Math.round(sales.reduce((n, x) => n + x.qty * (x.price || 0), 0) * 100) / 100,
      priceChanges: priceChanges.length
    },
    priceChanges: priceChanges.slice(0, 50),
    sales: sales.slice(0, 50),
    lowStock: items.filter(x => x.stock <= 5).sort((a, b) => a.stock - b.stock),
    items
  });
});

// Add a product FROM a searched photo: saves the photo as the product image
// so the item is found in future picture searches.
app.post('/api/products/from-photo', auth.requireAdmin, (req, res) => {
  const b = req.body || {};
  const b64 = String(b.image || '').replace(/^data:image\/[a-z+.-]+;base64,/i, '');
  if (!b.title || b.price == null || !b64) {
    return res.status(400).json({ error: 'title, price and image are required' });
  }
  const upDir = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(upDir)) fs.mkdirSync(upDir, { recursive: true });
  const file = `item-${Date.now()}.jpg`;
  fs.writeFileSync(path.join(upDir, file), Buffer.from(b64, 'base64'));

  // barcode: use the given one, or generate a valid in-store UPC
  let barcode = String(b.barcode || '').replace(/\D/g, '');
  if (!barcode) {
    const body11 = '19999' + String(Math.floor(100000 + Math.random() * 899999));
    const digits = body11.split('').map(Number);
    let odd = 0, even = 0;
    digits.forEach((n, i) => (i % 2 === 0 ? (odd += n) : (even += n)));
    barcode = body11 + ((10 - ((odd * 3 + even) % 10)) % 10);
  }

  const d = db.load();
  const p = db.upsertProduct(d, {
    title: b.title,
    brand: b.brand || '',
    category: b.category || 'Other',
    sku: b.sku || '',
    description: b.description || '',
    msrp: b.msrp ? Number(b.msrp) : null,
    cost: b.cost ? Number(b.cost) : null,
    material: b.material || '',
    weight: b.weight || '',
    supplier: b.supplier || '',
    status: b.status || 'active',
    details: b.details || null,
    barcode,
    price: Number(b.price),
    stock: b.stock != null ? Number(b.stock) : 1,
    currency: 'USD',
    image: '/uploads/' + file,
    asin: b.asin || ''
  });
  db.save(d);
  res.json(p);
});

// Customer checkout: records each cart item as a sale (dated, price kept)
// and reduces stock — shows up in the admin Report automatically.
app.post('/api/checkout', (req, res) => {
  const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: 'cart is empty' });
  const d = db.load();
  let count = 0, total = 0;
  for (const it of items) {
    const p = db.recordSale(d, Number(it.id), Number(it.qty) || 1);
    if (p) { count += Number(it.qty) || 1; total += p.price * (Number(it.qty) || 1); }
  }
  db.save(d);
  res.json({ ok: true, itemsSold: count, total: Math.round(total * 100) / 100 });
});

// One-click import: search Amazon for a product name and add the top
// matches to the store with FULL details (ASIN, barcode, image, description,
// MSRP, price — with a dated price record). Admin only.
app.post('/api/import-from-amazon', auth.requireAdmin, async (req, res) => {
  const query = String((req.body && req.body.query) || '').trim();
  const asin = String((req.body && req.body.asin) || '').trim();
  if (!query) return res.status(400).json({ error: 'query is required' });

  const cfgFile = path.join(__dirname, 'config.json');
  const cfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, 'utf8')) : {};
  if (!amazon.hasKeys(cfg)) {
    // Without API keys, still try to add item with just ASIN
    if (asin) {
      const d = db.load();
      const existing = d.products.find(p => p.asin === asin);
      if (existing) return res.json({ added: [existing] });
      const p = db.upsertProduct(d, {
        title: query, asin, barcode: '', price: 0,
        brand: '', category: req.body.category || 'Other', stock: 0
      });
      db.save(d);
      return res.json({ added: [p] });
    }
    return res.status(503).json({
      error: 'Amazon API keys are not set up yet.',
      setup: 'Copy config.example.json to config.json and fill accessKey, secretKey, partnerTag from your Amazon Associates account (Tools -> Product Advertising API). Then this button imports items automatically.'
    });
  }

  try {
    const found = await amazon.searchAmazon(query, cfg, 3);
    if (!found.length) return res.status(404).json({ error: `Amazon returned no items for "${query}".` });
    const d = db.load();
    const added = found.map(it => db.upsertProduct(d, { ...it, category: req.body.category || 'Other', stock: it.stock || 0 }));
    db.save(d);
    res.json({ added });
  } catch (e) {
    res.status(502).json({ error: 'Amazon search failed: ' + e.message });
  }
});

// Simple in-memory cache for image search (keyed by first 64 chars of base64 hash)
const imgSearchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Image search engine — combines up to 4 AI engines:
//   1. Built-in CLIP AI (always on, free, no key, single inference)
//   2. Google Vision      (if googleVisionApiKey in config.json)
//   3. Claude Vision      (if anthropicApiKey in config.json)
//   4. Google Gemini      (if geminiApiKey in config.json)
// Body: { image: "<base64 or data URL>" }
app.post('/api/search-image', async (req, res) => {
  const raw = (req.body && req.body.image) || '';
  const mt = (raw.match(/^data:(image\/[a-z+.-]+);base64,/i) || [])[1] || 'image/jpeg';
  const b64 = raw.replace(/^data:image\/[a-z+.-]+;base64,/i, '');
  if (!b64) return res.status(400).json({ error: 'image (base64) is required' });

  const cacheKey = b64.slice(0, 64);
  const cached = imgSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return res.json(cached.data);
  }

  const cfgFile = path.join(__dirname, 'config.json');
  const cfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, 'utf8')) : {};
  const hasKey = k => cfg[k] && !String(cfg[k]).startsWith('YOUR_');
  const d = db.load();

  const engines = {};
  const jobs = [];

  // 1. Built-in CLIP — single combined inference for category + product matching
  jobs.push(clip.analyzeImage(b64, d.products)
    .then(({ category, matches }) => {
      engines.builtin = { ok: true, category, results: matches.slice(0, 8) };
    })
    .catch(e => {
      engines.builtin = { ok: false, error: clip.getStatus() === 'loading'
        ? 'Built-in AI is still downloading (first run) — try again in a minute.'
        : (/Cannot find (package|module)/.test(e.message) ? 'Built-in AI not installed — close the store window and run Start-Store.bat again.' : e.message) };
    }));

  // 2. Google Vision (now runs before Claude since it's weighted highest)
  if (hasKey('googleVisionApiKey')) {
    jobs.push(vision.detect(b64, cfg.googleVisionApiKey)
      .then(det => {
        engines.google = { ok: true, detected: det.bestGuesses.concat(det.logos).slice(0, 5).join(', '), results: vision.rankProducts(d.products, det) };
      })
      .catch(e => { engines.google = { ok: false, error: e.message }; }));
  } else engines.google = { ok: false, error: 'no key' };

  // 3. Claude Vision
  if (hasKey('anthropicApiKey')) {
    jobs.push(claude.detectPhone(b64, mt, cfg.anthropicApiKey, cfg.claudeModel)
      .then(text => {
        const det = { bestGuesses: text ? [text] : [], entities: [], labels: [], logos: [] };
        engines.claude = { ok: true, detected: text, results: vision.rankProducts(d.products, det) };
      })
      .catch(e => { engines.claude = { ok: false, error: e.message }; }));
  } else engines.claude = { ok: false, error: 'no key' };

  // 4. Google Gemini
  if (hasKey('geminiApiKey')) {
    jobs.push(gemini.detectProduct(b64, mt, cfg.geminiApiKey, cfg.geminiModel)
      .then(text => {
        const det = { bestGuesses: text ? [text] : [], entities: [], labels: [], logos: [] };
        engines.gemini = { ok: true, detected: text, results: vision.rankProducts(d.products, det) };
      })
      .catch(e => { engines.gemini = { ok: false, error: e.message }; }));
  } else engines.gemini = { ok: false, error: 'no key' };

  await Promise.all(jobs);

  let category = engines.builtin.ok ? engines.builtin.category : null;

  // Combine: normalize each engine's scores to 0..1, then weighted sum.
  // Google (Lens technology / Cloud Vision) is the MAIN engine; others assist.
  const weights = { google: 2.0, gemini: 1.6, claude: 1.2, builtin: 1.0 };
  const combined = new Map();
  for (const [name, eng] of Object.entries(engines)) {
    if (!eng.ok || !eng.results || !eng.results.length) continue;
    const max = Math.max(...eng.results.map(r => r.score));
    for (const r of eng.results) {
      const cur = combined.get(r.product.id) || { product: r.product, score: 0, engines: [] };
      cur.score += (max ? r.score / max : 0) * weights[name];
      cur.engines.push(name);
      combined.set(r.product.id, cur);
    }
  }
  const combinedArr = [...combined.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const matches = combinedArr
    .map(m => ({ ...m.product, matchScore: Math.round(m.score * 100) / 100, matchedBy: m.engines }));

  // Determine if there's a direct match (auto-navigate to product)
  let directMatch = null;
  if (combinedArr.length > 0) {
    const top = combinedArr[0].score;
    const second = combinedArr.length > 1 ? combinedArr[1].score : 0;
    if (top >= 0.7 && top >= second * 1.2) {
      directMatch = matches[0];
    }
  }

  const anyOk = Object.values(engines).some(e => e.ok);
  const engineSummary = {
    builtin: engines.builtin.ok ? 'ok' : engines.builtin.error,
    google: engines.google.ok ? 'ok — saw: ' + (engines.google.detected || 'nothing') : engines.google.error,
    claude: engines.claude.ok ? 'ok — saw: ' + (engines.claude.detected || 'no product') : engines.claude.error,
    gemini: engines.gemini.ok ? 'ok — saw: ' + (engines.gemini.detected || 'no product') : engines.gemini.error
  };
  // best available name for the item (cloud engines give exact model;
  // otherwise fall back to closest catalog match + category)
  const identified =
    (engines.gemini.ok && engines.gemini.detected) ||
    (engines.claude.ok && engines.claude.detected) ||
    (engines.google.ok && engines.google.detected) ||
    (matches[0] ? `${matches[0].brand} ${matches[0].title}`.trim() : '') ||
    (category ? category.label : '');

  // Trust a confident product match over CLIP's zero-shot category label.
  const stocked = ['shoes', 'bag', 'accessories', 'barcode label'];
  const confidentMatch = matches.length && matches[0].matchScore >= 0.5;
  if (confidentMatch && (!category || !stocked.includes(category.label))) {
    category = { label: matches[0].category, score: matches[0].matchScore };
  }

  const base = {
    primary: engines.google.ok ? 'google' : (engines.claude.ok ? 'claude' : 'builtin'),
    engines: engineSummary,
    category,
    identified,
    directMatch
  };

  // Item is (probably) something we stock -> show catalog matches.
  const inCatalog = (!category || stocked.includes(category.label)) || confidentMatch;
  if (inCatalog) {
    const result = { ...base, inCatalog: true, matches };
    imgSearchCache.set(cacheKey, { ts: Date.now(), data: result });
    return res.status(anyOk ? 200 : 503).json(result);
  }

  // If Amazon keys are configured, search Amazon and import into our database
  if (amazon.hasKeys(cfg)) {
    try {
      const found = await amazon.searchAmazon(identified, cfg, 3);
      const added = found.map(it => db.upsertProduct(d, it));
      db.save(d);
      const result = { ...base, inCatalog: false, addedFromAmazon: added };
      imgSearchCache.set(cacheKey, { ts: Date.now(), data: result });
      return res.json(result);
    } catch (e) {
      return res.json({ ...base, inCatalog: false, amazonError: 'Amazon search failed: ' + e.message });
    }
  }
  const result = {
    ...base, inCatalog: false,
    amazonError: 'Auto-import needs your Amazon API keys in config.json (see README — Connect real Amazon data).'
  };
  imgSearchCache.set(cacheKey, { ts: Date.now(), data: result });
  res.json(result);
});

// Built-in AI status (used by the UI to show download progress on first run)
app.get('/api/ai-status', (req, res) => res.json({ status: clip.getStatus() }));

auth.ensureDefaultAdmin();

app.listen(PORT, () => {
  console.log(`Store running at http://localhost:${PORT}`);
  console.log('Loading built-in AI image search (first run downloads ~120 MB, then cached)...');
  clip.warmup();
});
