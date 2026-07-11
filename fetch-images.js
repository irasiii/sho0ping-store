// Downloads a REAL photo for every product into public/images/ and points
// the database at the local file — images then load instantly and never
// break, even offline. Run once (or anytime): node fetch-images.js
// (Photos come from loremflickr.com — free-to-use community photos matched
// by product type. Amazon imports later replace them with official photos.)
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');

const IMG_DIR = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

function tagFor(p) {
  const t = (p.details && p.details.type) || '';
  const map = {
    Sneakers: 'sneakers', Running: 'sneakers', Walking: 'sneakers', Casual: 'sneakers',
    'Light-Up': 'sneakers', Boots: 'boots', Sandals: 'sandals', Heels: 'highheels',
    Dress: 'shoes', Backpack: 'backpack', Tote: 'handbag', Satchel: 'handbag',
    Shoulder: 'handbag', Crossbody: 'handbag', 'Mini Bag': 'handbag', Clutch: 'handbag',
    Wallet: 'wallet', Belt: 'belt', Sunglasses: 'sunglasses', Cap: 'hat', Socks: 'socks'
  };
  const catMap = { Bags: 'handbag', Accessories: 'fashion', Shoes: 'sneakers' };
  return map[t] || catMap[p.category] || 'shoes';
}

async function grab(url) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const type = r.headers.get('content-type') || '';
  if (buf.length < 5000 || !type.startsWith('image/')) throw new Error('not a usable image');
  return buf;
}

(async () => {
  const d = db.load();
  let ok = 0, skip = 0, fail = 0;

  for (const p of d.products) {
    // skip photos the admin uploaded and already-downloaded ones
    if (String(p.image || '').startsWith('/uploads/')) { skip++; continue; }
    const file = `real-${p.id}.jpg`;
    const dest = path.join(IMG_DIR, file);

    if (!fs.existsSync(dest)) {
      const tag = tagFor(p);
      const tries = [
        `https://loremflickr.com/600/800/${tag}?lock=${p.id}`,
        `https://loremflickr.com/600/800/${tag}?lock=${p.id + 137}`
      ];
      let saved = false;
      for (const url of tries) {
        try {
          fs.writeFileSync(dest, await grab(url));
          saved = true;
          break;
        } catch (e) { /* try next source */ }
      }
      if (!saved) { console.log(`  ✗ ${p.title} — could not download, keeping current image`); fail++; continue; }
    }

    p.image = '/images/' + file;      // local, fast,reliable
    ok++;
    console.log(`  ✓ ${p.title} -> ${file}`);
  }

  db.save(d);
  console.log(`\nDone. ${ok} photos saved locally, ${skip} kept (admin uploads), ${fail} failed.`);
  console.log('Restart the store (Start-Store.bat) and refresh the browser.');
})();
