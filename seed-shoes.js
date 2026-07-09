// Seeds the store with a full shoe catalog: Men, Women, Boys, Girls.
// Each item: barcode (valid UPC-A check digit), category, details (type,
// color, sizes), price, stock, cost, material, weight, supplier, status, tags.
// Run: node seed-shoes.js
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

const CAT_MATERIALS = {
  Sneakers: 'Mesh/Textile', Running: 'Mesh/Textile', Walking: 'Mesh/Textile',
  Casual: 'Canvas', Boots: 'Leather', Sandals: 'Synthetic',
  Heels: 'Leather/Synthetic', Dress: 'Leather', 'Light-Up': 'Synthetic/Textile'
};

const CAT_SUPPLIERS = {
  Nike: 'Nike Inc.', Adidas: 'Adidas AG', 'New Balance': 'New Balance Athletics',
  Timberland: 'VF Corporation', Skechers: 'Skechers USA Inc.',
  Converse: 'Converse / Nike', Clarks: 'Clarks PLC', Crocs: 'Crocs Inc.',
  Puma: 'Puma SE', 'Steve Madden': 'Steve Madden Ltd.', UGG: 'Deckers Brands',
  Birkenstock: 'Birkenstock Group', 'Under Armour': 'Under Armour Inc.'
};

const shoes = [
  { cat: 'Men',   brand: 'Nike',       title: 'Air Max 270 Running Shoes',        type: 'Sneakers', color: 'Black/White',  sizes: '7-13',  price: 129.99, stock: 24, hue: '#2b2b2e' },
  { cat: 'Men',   brand: 'Adidas',     title: 'Ultraboost 24 Running Shoes',      type: 'Sneakers', color: 'Core Black',   sizes: '7-13',  price: 179.99, stock: 18, hue: '#1e1e22' },
  { cat: 'Men',   brand: 'New Balance',title: '574 Classic Sneakers',             type: 'Sneakers', color: 'Grey',         sizes: '7-14',  price: 89.99,  stock: 30, hue: '#8f8f93' },
  { cat: 'Men',   brand: 'Timberland', title: '6-Inch Premium Waterproof Boots',  type: 'Boots',    color: 'Wheat',        sizes: '8-13',  price: 198.00, stock: 12, hue: '#b0803f' },
  { cat: 'Men',   brand: 'Skechers',   title: 'Go Walk Max Slip-On',              type: 'Walking',  color: 'Navy',         sizes: '7-13',  price: 65.00,  stock: 40, hue: '#2c3d5e' },
  { cat: 'Men',   brand: 'Converse',   title: 'Chuck Taylor All Star High Top',   type: 'Casual',   color: 'Black',        sizes: '6-13',  price: 65.00,  stock: 35, hue: '#333336' },
  { cat: 'Men',   brand: 'Clarks',     title: 'Tilden Cap Oxford Dress Shoes',    type: 'Dress',    color: 'Dark Tan',     sizes: '7-13',  price: 75.00,  stock: 15, hue: '#6e4b2a' },
  { cat: 'Men',   brand: 'Crocs',      title: 'Classic Clog',                     type: 'Sandals',  color: 'Slate Grey',   sizes: '7-13',  price: 49.99,  stock: 50, hue: '#5a5f66' },
  { cat: 'Men',   brand: 'Puma',       title: 'Suede Classic XXI',                type: 'Sneakers', color: 'Red/White',    sizes: '7-13',  price: 74.99,  stock: 20, hue: '#a33333' },
  { cat: 'Women', brand: 'Nike',       title: 'Air Force 1 \'07 Women',           type: 'Sneakers', color: 'White',        sizes: '5-11',  price: 114.99, stock: 28, hue: '#e8e6e0' },
  { cat: 'Women', brand: 'Adidas',     title: 'Grand Court 2.0 Women',            type: 'Sneakers', color: 'White/Rose',   sizes: '5-11',  price: 64.99,  stock: 32, hue: '#e3c8ca' },
  { cat: 'Women', brand: 'Skechers',   title: 'D\'Lites Memory Foam Women',       type: 'Sneakers', color: 'White/Silver', sizes: '5-11',  price: 69.99,  stock: 26, hue: '#c9ccd4' },
  { cat: 'Women', brand: 'Steve Madden', title: 'Daisie Pointed Toe Pumps',       type: 'Heels',    color: 'Black Patent', sizes: '5-11',  price: 89.95,  stock: 14, hue: '#1a1a1c' },
  { cat: 'Women', brand: 'UGG',        title: 'Classic Short II Boots Women',     type: 'Boots',    color: 'Chestnut',     sizes: '5-11',  price: 170.00, stock: 10, hue: '#8a5a33' },
  { cat: 'Women', brand: 'Birkenstock', title: 'Arizona Soft Footbed Sandals',    type: 'Sandals',  color: 'Mocha',        sizes: '5-11',  price: 135.00, stock: 16, hue: '#7a5c44' },
  { cat: 'Women', brand: 'New Balance', title: 'Fresh Foam 1080v13 Women',        type: 'Running',  color: 'Lilac',        sizes: '5-11',  price: 164.99, stock: 15, hue: '#b9a6d0' },
  { cat: 'Women', brand: 'Converse',   title: 'Chuck Taylor Lift Platform Women', type: 'Casual',   color: 'White',        sizes: '5-11',  price: 75.00,  stock: 22, hue: '#efefe9' },
  { cat: 'Women', brand: 'Crocs',      title: 'Brooklyn Low Wedge Women',         type: 'Sandals',  color: 'Black',        sizes: '5-11',  price: 59.99,  stock: 25, hue: '#26262a' },
  { cat: 'Boys',  brand: 'Nike',       title: 'Revolution 7 Boys (Little Kids)',  type: 'Sneakers', color: 'Blue/Volt',    sizes: '11C-3Y', price: 52.99, stock: 30, hue: '#2456a8' },
  { cat: 'Boys',  brand: 'Adidas',     title: 'Duramo SL Boys (Big Kids)',        type: 'Running',  color: 'Black/Lime',   sizes: '3.5Y-7Y', price: 54.99, stock: 24, hue: '#3a4a1e' },
  { cat: 'Boys',  brand: 'Skechers',   title: 'S Lights Flex-Glow Boys',          type: 'Light-Up', color: 'Charcoal/Red', sizes: '10.5C-4Y', price: 47.00, stock: 20, hue: '#4b3038' },
  { cat: 'Boys',  brand: 'Under Armour', title: 'Assert 10 Boys School Shoes',    type: 'Running',  color: 'Black/White',  sizes: '3.5Y-7Y', price: 57.99, stock: 18, hue: '#2f2f33' },
  { cat: 'Boys',  brand: 'Crocs',      title: 'Classic Clog Kids Boys',           type: 'Sandals',  color: 'Navy',         sizes: '8C-3Y',  price: 39.99, stock: 40, hue: '#243350' },
  { cat: 'Boys',  brand: 'New Balance', title: '888v2 Boys Hook and Loop',        type: 'Sneakers', color: 'Team Royal',   sizes: '10.5C-4Y', price: 54.99, stock: 16, hue: '#2a4a9e' },
  { cat: 'Girls', brand: 'Nike',       title: 'Flex Runner 3 Girls (Little Kids)', type: 'Sneakers', color: 'Pink Foam',   sizes: '11C-3Y', price: 47.99, stock: 28, hue: '#e8a7bd' },
  { cat: 'Girls', brand: 'Adidas',     title: 'Grand Court 2.0 Girls',             type: 'Sneakers', color: 'White/Pink',  sizes: '10.5C-4Y', price: 49.99, stock: 26, hue: '#f0d3dc' },
  { cat: 'Girls', brand: 'Skechers',   title: 'Twinkle Toes Light-Up Girls',       type: 'Light-Up', color: 'Multi/Rainbow', sizes: '10.5C-4Y', price: 49.00, stock: 22, hue: '#c76bb7' },
  { cat: 'Girls', brand: 'Converse',   title: 'Chuck Taylor All Star Girls Low',   type: 'Casual',   color: 'Pink Glaze',  sizes: '10.5C-3Y', price: 44.99, stock: 20, hue: '#dd8fae' },
  { cat: 'Girls', brand: 'Crocs',      title: 'Classic Glitter Clog Girls',        type: 'Sandals',  color: 'Ballerina Pink', sizes: '8C-3Y', price: 44.99, stock: 34, hue: '#e5a3c0' },
  { cat: 'Girls', brand: 'UGG',        title: 'Keelan Kids Boots Girls',           type: 'Boots',    color: 'Chestnut',    sizes: '13C-4Y', price: 110.00, stock: 8,  hue: '#96683e' }
];

function shoeSvg(s) {
  const label = `${s.brand} ${s.title}`.slice(0, 36);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="380" viewBox="0 0 300 380">
  <rect width="300" height="380" fill="#f6f7f9"/>
  <path d="M45 220 q10 -55 60 -60 q28 -3 42 18 q12 18 40 24 l58 12 q22 5 22 24 l0 8 q0 12 -14 12 l-190 0 q-20 0 -18 -20 z" fill="${s.hue}" stroke="#1a1a1a" stroke-width="3"/>
  <path d="M45 246 l212 0 l0 10 q0 8 -10 8 l-192 0 q-12 0 -10 -14 z" fill="#ddd" stroke="#1a1a1a" stroke-width="2"/>
  <circle cx="110" cy="185" r="4" fill="#fff"/><circle cx="126" cy="192" r="4" fill="#fff"/><circle cx="142" cy="200" r="4" fill="#fff"/>
  <text x="150" y="300" text-anchor="middle" font-family="Segoe UI, Arial" font-size="15" font-weight="600" fill="#222">${s.brand} · ${s.cat}</text>
  <text x="150" y="324" text-anchor="middle" font-family="Segoe UI, Arial" font-size="11" fill="#555">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
</svg>`;
}

const imgDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

const d = db.load();

// tag existing items (phones) with a category so the catalog filter works
for (const p of d.products) if (!p.category) p.category = 'Phones';

shoes.forEach((s, i) => {
  const barcode = upc('19700' + String(240001 + i));
  const file = `shoe-${i + 1}.svg`;
  fs.writeFileSync(path.join(imgDir, file), shoeSvg(s));
  const cost = Math.round(s.price * (0.55 + Math.random() * 0.15) * 100) / 100;
  const type = s.type || '';
  const w = 0.6 + Math.random() * 0.8;

  db.upsertProduct(d, {
    title: s.title,
    brand: s.brand,
    category: s.cat,
    details: { type: s.type, color: s.color, sizes: s.sizes },
    barcode,
    price: s.price,
    stock: s.stock,
    cost,
    material: CAT_MATERIALS[type] || 'Various',
    weight: w.toFixed(2) + ' lbs',
    supplier: CAT_SUPPLIERS[s.brand] || `${s.brand} Inc.`,
    status: 'active',
    tags: [s.cat, type].filter(Boolean),
    currency: 'USD',
    image: `/images/${file}`,
    samplePicture: `/sample-pictures/shoe-${i + 1}.png`,
    asin: ''
  });
});
db.save(d);
console.log(`Seeded ${shoes.length} shoes (Men/Women/Boys/Girls) with complete inventory fields.`);
