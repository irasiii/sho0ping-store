// One-time migration: adds SKU, description, MSRP, cost, material, weight,
// supplier, status, tags to every product.
const db = require('./lib/db');

const CAT_MATERIALS = {
  Sneakers: 'Mesh/Textile', Running: 'Mesh/Textile', Walking: 'Mesh/Textile',
  Casual: 'Canvas', Boots: 'Leather', Sandals: 'Synthetic',
  Heels: 'Leather/Synthetic', Dress: 'Leather', 'Light-Up': 'Synthetic/Textile',
  Backpack: 'Polyester', Duffel: 'Polyester', Tote: 'Leather',
  Socks: 'Cotton', Insoles: 'Foam', 'Shoe care': 'Various'
};

const CAT_SUPPLIERS = {
  Nike: 'Nike Inc.', Adidas: 'Adidas AG', 'New Balance': 'New Balance Athletics',
  Timberland: 'VF Corporation', Skechers: 'Skechers USA Inc.',
  Converse: 'Converse / Nike', Clarks: 'Clarks PLC', Crocs: 'Crocs Inc.',
  Puma: 'Puma SE', 'Steve Madden': 'Steve Madden Ltd.', UGG: 'Deckers Brands',
  Birkenstock: 'Birkenstock Group', 'Under Armour': 'Under Armour Inc.',
  JanSport: 'VF Corporation', 'Michael Kors': 'Capri Holdings',
  Herschel: 'Herschel Supply Co.', "Dr. Scholl's": 'Bayer AG',
  'Crep Protect': 'Crep Protect Ltd.'
};

const d = db.load();
for (const p of d.products) {
  const cat3 = (p.category || 'GEN').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'GEN';
  const brand3 = (p.brand || 'XXX').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'XXX';
  if (!p.sku) p.sku = `${cat3}-${brand3}-${String(p.id).padStart(4, '0')}`;
  if (!p.msrp) {
    p.msrp = Math.max(p.price, Math.floor(p.price * 1.25) + 0.99);
  }
  if (!p.description) {
    const det = p.details || {};
    const bits = [];
    bits.push(`${p.brand} ${p.title}.`);
    if (det.type) bits.push(`Type: ${det.type}.`);
    if (det.color && det.color !== '-') bits.push(`Color: ${det.color}.`);
    if (det.sizes && det.sizes !== '-') bits.push(`Available sizes: ${det.sizes}.`);
    if (p.category) bits.push(`Department: ${p.category}.`);
    p.description = bits.join(' ');
  }
  if (p.asin == null) p.asin = '';
  if (p.cost == null) {
    const margin = 0.55 + Math.random() * 0.15;
    p.cost = Math.round(p.price * margin * 100) / 100;
  }
  const type = (p.details && p.details.type) || '';
  if (!p.material) p.material = CAT_MATERIALS[type] || 'Various';
  if (!p.weight) {
    const w = p.category === 'Bags' ? 0.8 + Math.random() * 1.5
      : p.category === 'Accessories' ? 0.1 + Math.random() * 0.4
      : 0.6 + Math.random() * 0.8;
    p.weight = w.toFixed(2) + ' lbs';
  }
  if (!p.supplier) p.supplier = CAT_SUPPLIERS[p.brand] || `${p.brand || 'Generic'} Inc.`;
  if (!p.status) p.status = 'active';
  if (!p.tags) p.tags = [p.category || 'General', type].filter(Boolean);
  if (p.sold == null) p.sold = db.soldFor(d, p.id);
}
db.save(d);
const s = d.products[0];
console.log(`enriched ${d.products.length} items. Example:`, s.sku, '| MSRP', s.msrp, '| cost', s.cost, '|', s.material, '|', s.weight, '|', s.supplier, '|', s.status);
