const fs = require('fs');
const os = require('os');
const path = require('path');

let clfPromise = null;
let status = 'idle';

function getStatus() { return status; }

function classifier() {
  if (!clfPromise) {
    status = 'loading';
    clfPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      env.cacheDir = path.join(__dirname, '..', 'data', 'models');
      const clf = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
      status = 'ready';
      return clf;
    })().catch(e => { status = 'failed'; clfPromise = null; throw e; });
  }
  return clfPromise;
}

function warmup() {
  classifier().catch(e => console.error('Built-in AI failed to load:', e.message));
}

const CATEGORIES = [
  ['shoes', 'a photo of shoes, sneakers or footwear'],
  ['bag', 'a photo of a handbag, backpack or duffel bag'],
  ['accessories', 'a photo of socks, insoles or shoe care products'],
  ['watch', 'a photo of a wrist watch'],
  ['laptop', 'a photo of a laptop computer'],
  ['tablet', 'a photo of a tablet device'],
  ['headphones', 'a photo of headphones or earbuds'],
  ['camera', 'a photo of a camera'],
  ['game console', 'a photo of a video game console or controller'],
  ['TV', 'a photo of a television'],
  ['barcode label', 'a photo of a barcode label']
];

function buildProductLabel(p) {
  const d = p.details || {};
  const color = (d.color || '').replace(/\//g, ' ');
  const material = (p.material || '').replace(/\//g, ' ');
  const type = d.type || '';
  const cat = (p.category || '').toLowerCase();
  const brand = p.brand || '';
  const title = p.title || '';
  const desc = p.description || '';

  const tokens = [];
  if (brand) tokens.push(`brand ${brand}`);
  tokens.push(title);
  if (type) tokens.push(type);
  if (color) tokens.push(`${color} color`);
  if (material) tokens.push(`made of ${material}`);
  if (cat) tokens.push(cat);
  if (desc) {
    const short = desc.split('.').slice(0, 2).join('. ').trim();
    if (short.length > 10) tokens.push(short);
  }
  return tokens.join(', ');
}

async function analyzeImage(base64Image, products) {
  const clf = await classifier();
  const { RawImage } = await import('@xenova/transformers');
  const tmp = path.join(os.tmpdir(), `clip-${Date.now()}.png`);
  fs.writeFileSync(tmp, Buffer.from(base64Image, 'base64'));
  let image;
  try {
    image = await RawImage.read(tmp);
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
  if (!image) throw new Error('Could not decode image');

  const catLabels = CATEGORIES.map(c => c[1]);
  const prodLabels = products.map(p => buildProductLabel(p));

  const results = await clf(image, catLabels.concat(prodLabels));

  const catResults = results.filter(r => catLabels.includes(r.label));
  const prodResults = results.filter(r => prodLabels.includes(r.label));

  catResults.sort((a, b) => b.score - a.score);
  const topCat = catResults[0] || { label: catLabels[0], score: 0 };
  const catIdx = catLabels.indexOf(topCat.label);
  const category = {
    label: catIdx >= 0 ? CATEGORIES[catIdx][0] : 'unknown',
    score: Math.round(topCat.score * 100) / 100
  };

  const matches = prodResults
    .map(r => ({ product: products[prodLabels.indexOf(r.label)], score: r.score }))
    .filter(r => r.product)
    .sort((a, b) => b.score - a.score);

  return { category, matches };
}

module.exports = { analyzeImage, warmup, getStatus };