// Seeds the store with a ladies bags catalog (handbags, totes, clutches,
// crossbody, shoulder, satchel, backpack, wallet). Each item gets a valid
// UPC-A barcode, full inventory fields, and a generated SVG image.
// Run: node seed-bags.js  (or via `npm run seed`, which also seeds shoes)
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');

function upc(body11) {
  const d = body11.split('').map(Number);
  let odd = 0, even = 0;
  d.forEach((n, i) => (i % 2 === 0 ? (odd += n) : (even += n)));
  const check = (10 - ((odd * 3 + even) % 10)) % 10;
  return body11 + check;
}

const BAG_MATERIALS = {
  Tote: 'Canvas', Clutch: 'Faux Leather', Crossbody: 'Faux Leather',
  Shoulder: 'Leather', Satchel: 'Leather', Backpack: 'Nylon',
  Wallet: 'Leather', 'Mini Bag': 'Faux Leather', Handbag: 'Leather'
};

const BAG_SUPPLIERS = {
  'Michael Kors': 'Capri Holdings', Coach: 'Tapestry Inc.',
  'Kate Spade': 'Tapestry Inc.', Fossil: 'Fossil Group',
  'Calvin Klein': 'PVH Corp.', 'Tommy Hilfiger': 'PVH Corp.',
  'Charles & Keith': 'Charles & Keith Intl', Aldo: 'Aldo Group',
  'Nine West': 'Authentic Brands', Guess: 'Guess Inc.',
  Furla: 'Furla S.p.A.', Longchamp: 'Longchamp SAS'
};

const bags = [
  { brand: 'Michael Kors', title: 'Jet Set Travel Large Saffiano Leather Tote', type: 'Tote',      color: 'Black',          price: 358.00, stock: 18, hue: '#2a2a2c' },
  { brand: 'Michael Kors', title: 'Laila Medium Pebbled Leather Tote',          type: 'Tote',      color: 'Black',          price: 259.50, stock: 12, hue: '#1a1a1c' },
  { brand: 'Michael Kors', title: 'Jet Set Charm Leather Crossbody',            type: 'Crossbody', color: 'Soft Pink',      price: 159.50, stock: 14, hue: '#e8a7bd' },
  { brand: 'Michael Kors', title: 'Nolita Large Nubuck Hobo Shoulder Bag',      type: 'Shoulder',  color: 'Camel',          price: 298.00, stock: 10, hue: '#b0803f' },
  { brand: 'Michael Kors', title: 'Scarlett Large East West Top Zip Tote',      type: 'Tote',      color: 'Black',          price: 179.70, stock: 16, hue: '#26262a' },
  { brand: 'Michael Kors', title: 'Quinn Medium Pebbled Leather Tote',          type: 'Tote',      color: 'Black',          price: 199.50, stock: 13, hue: '#222' },
  { brand: 'Coach',        title: 'Tabby Shoulder Bag 26',                      type: 'Shoulder',  color: 'Signature Tan',   price: 350.00, stock: 12, hue: '#9c6b3f' },
  { brand: 'Coach',        title: 'Willis Top Handle Bag',                      type: 'Shoulder',  color: 'Chalk',          price: 375.00, stock: 9,  hue: '#efefe9' },
  { brand: 'Kate Spade',   title: 'Margaux Medium Satchel',                     type: 'Satchel',   color: 'Black',          price: 328.00, stock: 10, hue: '#1a1a1c' },
  { brand: 'Kate Spade',   title: 'Duo Mini Shoulder Bag',                      type: 'Mini Bag',  color: 'Black',          price: 158.00, stock: 22, hue: '#333336' },
  { brand: 'Kate Spade',   title: 'Do It All Tote Bag',                         type: 'Tote',      color: 'Black',          price: 298.00, stock: 19, hue: '#222' },
  { brand: 'Kate Spade',   title: 'Bond Mini Bag',                              type: 'Mini Bag',  color: 'Black',          price: 258.00, stock: 17, hue: '#1e1e22' },
  { brand: 'Kate Spade',   title: 'Deco Mini Crossbody Bag',                    type: 'Crossbody', color: 'Black',          price: 278.00, stock: 15, hue: '#26262a' },
  { brand: 'Kate Spade',   title: 'Loop Large Shoulder Bag',                    type: 'Shoulder',  color: 'Black',          price: 348.00, stock: 11, hue: '#2b2b2e' },
  { brand: 'Longchamp',    title: 'Le Pliage Original Tote',                    type: 'Tote',      color: 'French Rose',     price: 150.00, stock: 22, hue: '#d98aa6' },
  { brand: 'Longchamp',    title: 'Le Pliage Mini Backpack',                    type: 'Backpack',  color: 'Eucalyptus',      price: 175.00, stock: 15, hue: '#7d8470' },
  { brand: 'Fossil',       title: 'Fiona Crossbody Bag',                        type: 'Crossbody', color: 'Brown',           price: 129.00, stock: 20, hue: '#6e4b2a' },
  { brand: 'Fossil',       title: 'Rachel Satchel',                             type: 'Satchel',   color: 'Black',           price: 168.00, stock: 13, hue: '#1e1e22' },
  { brand: 'Calvin Klein', title: 'Rhea Chain Crossbody',                       type: 'Crossbody', color: 'Black',           price: 99.00,  stock: 16, hue: '#26262a' },
  { brand: 'Guess',        title: 'Logan Deluxe Satchel',                       type: 'Satchel',   color: 'Cognac',          price: 118.00, stock: 17, hue: '#8a5a33' }
];

function bagSvg(b) {
  const label = `${b.brand} ${b.title}`.slice(0, 34);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="380" viewBox="0 0 300 380">
  <rect width="300" height="380" fill="#f6f7f9"/>
  <path d="M108 205 q4 -52 42 -52 q38 0 42 52" fill="none" stroke="${b.hue}" stroke-width="7" stroke-linecap="round"/>
  <path d="M72 205 l156 0 l20 112 q2 16 -16 16 l-164 0 q-18 0 -16 -16 z" fill="${b.hue}" stroke="#1a1a1a" stroke-width="3"/>
  <rect x="134" y="232" width="32" height="16" rx="5" fill="#1a1a1a"/>
  <text x="150" y="300" text-anchor="middle" font-family="Segoe UI, Arial" font-size="15" font-weight="600" fill="#222">${b.brand} · Bags</text>
  <text x="150" y="324" text-anchor="middle" font-family="Segoe UI, Arial" font-size="11" fill="#555">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
</svg>`;
}

const imgDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

const d = db.load();

bags.forEach((b, i) => {
  const barcode = upc('19800' + String(350001 + i));
  const file = `bag-${i + 1}.svg`;
  fs.writeFileSync(path.join(imgDir, file), bagSvg(b));
  const cost = Math.round(b.price * (0.45 + Math.random() * 0.2) * 100) / 100;
  const type = b.type || '';
  const w = 0.4 + Math.random() * 1.2;

  db.upsertProduct(d, {
    title: b.title,
    brand: b.brand,
    category: 'Bags',
    details: { type: b.type, color: b.color },
    barcode,
    price: b.price,
    stock: b.stock,
    cost,
    material: BAG_MATERIALS[type] || 'Various',
    weight: w.toFixed(2) + ' lbs',
    supplier: BAG_SUPPLIERS[b.brand] || `${b.brand} Inc.`,
    status: 'active',
    tags: ['Bags', type].filter(Boolean),
    currency: 'USD',
    image: `/images/${file}`,
    samplePicture: `/sample-pictures/bag-${i + 1}.png`,
    asin: ''
  });
});
db.save(d);
console.log(`Seeded ${bags.length} ladies bags.`);
