// Seeds the database with a sample mobile phone catalog so the store works
// end-to-end before Amazon API keys are configured.
// NOTE: barcodes/prices here are SAMPLE data. Run `npm run sync` with real
// Amazon PA-API keys (see config.example.json) to replace with live data.
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');

const phones = [
  { brand: 'Apple',    title: 'iPhone 15 Pro Max 256GB Natural Titanium', barcode: '195949048586', price: 1199.00, color: '#8e8d92' },
  { brand: 'Apple',    title: 'iPhone 15 Pro 128GB Blue Titanium',        barcode: '195949037283', price: 999.00,  color: '#4d5a6b' },
  { brand: 'Apple',    title: 'iPhone 15 128GB Black',                    barcode: '195949036118', price: 799.00,  color: '#3b3b3d' },
  { brand: 'Apple',    title: 'iPhone 15 Plus 128GB Pink',                barcode: '195949041761', price: 899.00,  color: '#e3c8ca' },
  { brand: 'Apple',    title: 'iPhone 14 128GB Midnight',                 barcode: '194253408253', price: 699.00,  color: '#1f2430' },
  { brand: 'Apple',    title: 'iPhone SE (3rd Gen) 64GB Starlight',       barcode: '194252625378', price: 429.00,  color: '#f0ecdd' },
  { brand: 'Samsung',  title: 'Galaxy S24 Ultra 256GB Titanium Gray',     barcode: '887276794709', price: 1299.99, color: '#6f7378' },
  { brand: 'Samsung',  title: 'Galaxy S24+ 256GB Onyx Black',             barcode: '887276794518', price: 999.99,  color: '#2a2a2c' },
  { brand: 'Samsung',  title: 'Galaxy S24 128GB Marble Gray',             barcode: '887276794327', price: 799.99,  color: '#8f8f93' },
  { brand: 'Samsung',  title: 'Galaxy S23 FE 128GB Mint',                 barcode: '887276769509', price: 599.99,  color: '#b6d7c0' },
  { brand: 'Samsung',  title: 'Galaxy A54 5G 128GB Awesome Graphite',     barcode: '887276742021', price: 449.99,  color: '#4b4b4f' },
  { brand: 'Samsung',  title: 'Galaxy A15 5G 128GB Blue Black',           barcode: '887276815077', price: 199.99,  color: '#232a3a' },
  { brand: 'Samsung',  title: 'Galaxy Z Flip5 256GB Graphite',            barcode: '887276759104', price: 999.99,  color: '#3d3d40' },
  { brand: 'Samsung',  title: 'Galaxy Z Fold5 512GB Phantom Black',       barcode: '887276758923', price: 1919.99, color: '#26262a' },
  { brand: 'Google',   title: 'Pixel 8 Pro 128GB Obsidian',               barcode: '840244705824', price: 999.00,  color: '#2e2e30' },
  { brand: 'Google',   title: 'Pixel 8 128GB Hazel',                      barcode: '840244705633', price: 699.00,  color: '#7d8470' },
  { brand: 'Google',   title: 'Pixel 8a 128GB Bay',                       barcode: '840244707521', price: 499.00,  color: '#7fa8c9' },
  { brand: 'Google',   title: 'Pixel 7a 128GB Charcoal',                  barcode: '840244701819', price: 449.00,  color: '#43464a' },
  { brand: 'OnePlus',  title: 'OnePlus 12 256GB Silky Black',             barcode: '6921815626091', price: 799.99, color: '#1e1e22' },
  { brand: 'OnePlus',  title: 'OnePlus 12R 128GB Iron Gray',              barcode: '6921815626213', price: 499.99, color: '#5a5f66' },
  { brand: 'OnePlus',  title: 'OnePlus Nord N30 5G 128GB Chromatic Gray', barcode: '6921815624318', price: 299.99, color: '#9aa0a8' },
  { brand: 'Xiaomi',   title: 'Xiaomi 14 512GB Black',                    barcode: '6941812760765', price: 899.00, color: '#2b2b2e' },
  { brand: 'Xiaomi',   title: 'Redmi Note 13 Pro 256GB Midnight Black',   barcode: '6941812749821', price: 339.00, color: '#20242c' },
  { brand: 'Xiaomi',   title: 'Redmi 13C 128GB Navy Blue',                barcode: '6941812735596', price: 149.00, color: '#2c3d5e' },
  { brand: 'Motorola', title: 'Moto G Power 5G (2024) 128GB Midnight Blue', barcode: '840023250019', price: 299.99, color: '#28324a' },
  { brand: 'Motorola', title: 'Moto G 5G (2024) 128GB Sage Green',        barcode: '840023250262', price: 199.99, color: '#9db59a' },
  { brand: 'Motorola', title: 'Motorola Edge (2023) 256GB Nebula Green',  barcode: '840023241932', price: 599.99, color: '#3f5c50' },
  { brand: 'Nokia',    title: 'Nokia G310 5G 128GB Charcoal Black',       barcode: '6438409088512', price: 185.99, color: '#333336' },
  { brand: 'Sony',     title: 'Xperia 5 V 128GB Black',                   barcode: '4589771649824', price: 999.99, color: '#242427' },
  { brand: 'Nothing',  title: 'Nothing Phone (2a) 256GB Milk',            barcode: '6974434222335', price: 399.00, color: '#e8e6e0' }
];

// Generate a simple SVG product image for each phone (replaced by real Amazon
// image URLs after `npm run sync`).
function svgFor(p) {
  const label = p.title.length > 34 ? p.title.slice(0, 32) + '…' : p.title;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="380" viewBox="0 0 300 380">
  <rect width="300" height="380" fill="#f6f7f9"/>
  <rect x="90" y="40" width="120" height="240" rx="20" fill="${p.color}" stroke="#1a1a1a" stroke-width="3"/>
  <rect x="100" y="55" width="100" height="200" rx="6" fill="#0b0b0d"/>
  <circle cx="150" cy="270" r="5" fill="#0b0b0d"/>
  <rect x="112" y="66" width="26" height="26" rx="8" fill="#20242c" stroke="#3a3f47"/>
  <circle cx="125" cy="79" r="7" fill="#39404d"/>
  <text x="150" y="318" text-anchor="middle" font-family="Segoe UI, Arial" font-size="15" font-weight="600" fill="#222">${p.brand}</text>
  <text x="150" y="342" text-anchor="middle" font-family="Segoe UI, Arial" font-size="11" fill="#555">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
</svg>`;
}

const imgDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

const d = db.load();
phones.forEach((p, i) => {
  const file = `phone-${i + 1}.svg`;
  fs.writeFileSync(path.join(imgDir, file), svgFor(p));
  db.upsertProduct(d, {
    title: p.title,
    brand: p.brand,
    barcode: p.barcode,
    price: p.price,
    currency: 'USD',
    image: `/images/${file}`,
    samplePicture: `/sample-pictures/sample-${i + 1}.png`,
    asin: ''
  });
});
db.save(d);
console.log(`Seeded ${phones.length} phones. Start the store with: npm start`);
