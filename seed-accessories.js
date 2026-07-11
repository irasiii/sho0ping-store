// Seeds the store with a real accessories catalog (wallets, belts, caps,
// sunglasses, socks) so the "Accessories" filter has products. Each item gets
// a valid UPC-A barcode, full inventory fields, and a generated SVG (later
// replaced by a real photo by fetch-images.js). Run: node seed-accessories.js
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

const ACC_MATERIALS = {
  Wallet: 'Leather', Belt: 'Leather', Sunglasses: 'Acetate', Cap: 'Cotton', Socks: 'Cotton'
};

const ACC_SUPPLIERS = {
  'Michael Kors': 'Capri Holdings', Coach: 'Tapestry Inc.', Fossil: 'Fossil Group',
  Nike: 'Nike Inc.', 'Calvin Klein': 'PVH Corp.', 'Tommy Hilfiger': 'PVH Corp.',
  Adidas: 'Adidas AG', 'Ray-Ban': 'Luxottica', Oakley: 'Luxottica', 'Kate Spade': 'Tapestry Inc.'
};

const accessories = [
  { brand: 'Michael Kors', title: 'Jet Set Leather Wallet',        type: 'Wallet',     color: 'Saffiano Black', price: 128.00, stock: 20, hue: '#2a2a2c' },
  { brand: 'Coach',        title: 'Signature Card Case',           type: 'Wallet',     color: 'Tan',            price: 150.00, stock: 16, hue: '#9c6b3f' },
  { brand: 'Kate Spade',   title: 'Half-Moon Card Holder',         type: 'Wallet',     color: 'Black',          price: 98.00,  stock: 18, hue: '#1a1a1c' },
  { brand: 'Fossil',       title: 'Derrick Leather Belt',          type: 'Belt',       color: 'Brown',          price: 45.00,  stock: 25, hue: '#6e4b2a' },
  { brand: 'Calvin Klein', title: 'Leather Reversible Belt',       type: 'Belt',       color: 'Black',          price: 48.00,  stock: 22, hue: '#26262a' },
  { brand: 'Nike',         title: 'Heritage86 Futura Cap',         type: 'Cap',        color: 'Black',          price: 28.00,  stock: 40, hue: '#1e1e22' },
  { brand: 'Adidas',       title: 'Trefoil Classic Cap',           type: 'Cap',        color: 'White',          price: 25.00,  stock: 35, hue: '#e8e6e0' },
  { brand: 'Ray-Ban',      title: 'Wayfarer Sunglasses',           type: 'Sunglasses', color: 'Black',          price: 161.00, stock: 14, hue: '#111' },
  { brand: 'Oakley',       title: 'Holbrook Sunglasses',           type: 'Sunglasses', color: 'Matte Black',    price: 143.00, stock: 12, hue: '#222' },
  { brand: 'Tommy Hilfiger', title: 'Cotton Socks 3-Pack',         type: 'Socks',      color: 'Multi',          price: 18.00,  stock: 50, hue: '#243350' }
];

function accSvg(a) {
  const label = `${a.brand} ${a.title}`.slice(0, 34);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="380" viewBox="0 0 300 380">
  <rect width="300" height="380" fill="#f6f7f9"/>
  <rect x="95" y="150" width="110" height="80" rx="10" fill="${a.hue}" stroke="#1a1a1a" stroke-width="3"/>
  <text x="150" y="245" text-anchor="middle" font-family="Segoe UI, Arial" font-size="20" font-weight="700" fill="#fff">${a.type}</text>
  <text x="150" y="300" text-anchor="middle" font-family="Segoe UI, Arial" font-size="15" font-weight="600" fill="#222">${a.brand} · Accessories</text>
  <text x="150" y="324" text-anchor="middle" font-family="Segoe UI, Arial" font-size="11" fill="#555">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
</svg>`;
}

const imgDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

const d = db.load();

accessories.forEach((a, i) => {
  const barcode = upc('19900' + String(410001 + i));
  const file = `acc-${i + 1}.svg`;
  fs.writeFileSync(path.join(imgDir, file), accSvg(a));
  const cost = Math.round(a.price * (0.45 + Math.random() * 0.2) * 100) / 100;

  db.upsertProduct(d, {
    title: a.title,
    brand: a.brand,
    category: 'Accessories',
    details: { type: a.type, color: a.color },
    barcode,
    price: a.price,
    stock: a.stock,
    cost,
    material: ACC_MATERIALS[a.type] || 'Various',
    weight: '0.3 lbs',
    supplier: ACC_SUPPLIERS[a.brand] || `${a.brand} Inc.`,
    status: 'active',
    tags: ['Accessories', a.type].filter(Boolean),
    currency: 'USD',
    image: `/images/${file}`,
    samplePicture: `/sample-pictures/acc-${i + 1}.png`,
    asin: ''
  });
});
db.save(d);
console.log(`Seeded ${accessories.length} accessories.`);
