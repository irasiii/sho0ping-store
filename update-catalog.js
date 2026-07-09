// One-time catalog rebuild: remove phones, keep shoes, add bags & accessories,
// give every item a product photo (SVG primary, loremflickr as network fallback).
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');

function upc(body11) {
  const d = body11.split('').map(Number);
  let odd = 0, even = 0;
  d.forEach((n, i) => (i % 2 === 0 ? (odd += n) : (even += n)));
  return body11 + ((10 - ((odd * 3 + even) % 10)) % 10);
}

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

function bagSvg(s) {
  const label = `${s.brand} ${s.title}`.slice(0, 36);
  const cols = { Backpack: '#2b5a9e', Duffel: '#3a3a3e', Tote: '#8a6a44', Socks: '#eee', Insoles: '#4a8ad9', 'Shoe care': '#e04040' };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="380" viewBox="0 0 300 380">
  <rect width="300" height="380" fill="#f6f7f9"/>
  <rect x="60" y="90" width="180" height="220" rx="8" fill="${cols[s.type] || '#666'}" stroke="#1a1a1a" stroke-width="3"/>
  <rect x="100" y="70" width="100" height="30" rx="10" fill="${cols[s.type] || '#666'}" stroke="#1a1a1a" stroke-width="2"/>
  <text x="150" y="300" text-anchor="middle" font-family="Segoe UI, Arial" font-size="15" font-weight="600" fill="#222">${s.brand} · ${s.cat}</text>
  <text x="150" y="324" text-anchor="middle" font-family="Segoe UI, Arial" font-size="11" fill="#555">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
</svg>`;
}

const d = db.load();

// 1. remove all phones (products + their price records + sales)
const phoneIds = d.products.filter(p => (p.category || 'Phones') === 'Phones').map(p => p.id);
d.products = d.products.filter(p => !phoneIds.includes(p.id));
d.priceHistory = d.priceHistory.filter(h => !phoneIds.includes(h.productId));
d.sales = d.sales.filter(s => !phoneIds.includes(s.productId));
console.log('removed phones:', phoneIds.length);

// 2. real photos for shoes (SVG local, loremflickr as network fallback)
const tagFor = t => ({
  Sneakers: 'sneakers', Running: 'sneakers', Walking: 'sneakers', Casual: 'sneakers',
  'Light-Up': 'sneakers', Boots: 'boots', Sandals: 'sandals', Heels: 'highheels', Dress: 'shoes'
}[t] || 'shoes');

const imgDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

for (const p of d.products) {
  const t = p.details && p.details.type;
  if (!p.imageFallback) p.imageFallback = p.image;
  if (!p.image || p.image.includes('loremflickr')) {
    p.image = `https://loremflickr.com/600/600/${tagFor(t)}?lock=${p.id}`;
  }
}

// 3. other stock: bags & accessories (with local SVGs)
const extra = [
  { cat: 'Bags', brand: 'JanSport',   title: 'SuperBreak One Backpack',        type: 'Backpack', color: 'Black',       sizes: 'One size', price: 36.99, stock: 25, hue: '#1e3a6e' },
  { cat: 'Bags', brand: 'Nike',       title: 'Brasilia 9.5 Training Duffel',   type: 'Duffel',   color: 'Black/White', sizes: 'Medium',   price: 45.00, stock: 18, hue: '#2b2b30' },
  { cat: 'Bags', brand: 'Michael Kors', title: 'Jet Set Travel Tote',          type: 'Tote',     color: 'Brown Logo',  sizes: 'One size', price: 298.00, stock: 8,  hue: '#6b4c36' },
  { cat: 'Bags', brand: 'Herschel',   title: 'Classic XL Backpack',            type: 'Backpack', color: 'Navy',        sizes: 'XL',       price: 54.99, stock: 20, hue: '#1c2d4a' },
  { cat: 'Accessories', brand: 'Nike',     title: 'Everyday Cushioned Crew Socks 6-Pack', type: 'Socks',   color: 'White', sizes: 'M/L',     price: 22.00, stock: 60, hue: '#ddd' },
  { cat: 'Accessories', brand: 'Dr. Scholl\'s', title: 'Comfort Energy Insoles',          type: 'Insoles', color: 'Blue',  sizes: '8-13',    price: 12.98, stock: 45, hue: '#4a8ad9' },
  { cat: 'Accessories', brand: 'Crep Protect', title: 'Shoe Cleaning Kit',                type: 'Shoe care', color: '-',   sizes: '-',       price: 19.99, stock: 30, hue: '#e04040' },
  { cat: 'Accessories', brand: 'Adidas',   title: 'Superlite No-Show Socks 6-Pack Women', type: 'Socks',   color: 'Mixed', sizes: '5-10',    price: 20.00, stock: 55, hue: '#eee' }
];

let n = 0;
const maxId = Math.max(...d.products.map(p => p.id), 0);
extra.forEach((s, i) => {
  const barcode = upc('19700' + String(250001 + i));
  const svgFile = `extra-${i + 1}.svg`;
  fs.writeFileSync(path.join(imgDir, svgFile), bagSvg(s));
  const p = db.upsertProduct(d, {
    title: s.title, brand: s.brand, category: s.cat,
    details: { type: s.type, color: s.color, sizes: s.sizes },
    barcode, price: s.price, stock: s.stock, currency: 'USD',
    image: `/images/${svgFile}`, samplePicture: `/sample-pictures/extra-${i + 1}.png`, asin: ''
  });
  p.imageFallback = `https://loremflickr.com/600/600/${s.tag || s.type.toLowerCase()}?lock=${p.id}`;
  n++;
});
console.log('added other stock:', n);

db.save(d);
console.log('catalog now:', d.products.length, 'items:',
  [...new Set(d.products.map(p => p.category))].join(', '));
