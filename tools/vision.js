// Vision helper: describe an image using Google Gemini's vision model.
// Usage: node tools/vision.js <imagePath> [prompt]
// Reads the API key from GEMINI_API_KEY, else from gimini-key.txt in repo root.
// Writes the description to stdout (and a copy to .vision-last.txt).
const fs = require('fs');
const path = require('path');

const MODEL = process.argv[4] || process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  for (const name of ['gimini-key.txt', 'gimini-key', '.gimini-key']) {
    const p = path.join(__dirname, '..', name);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  }
  throw new Error('No Gemini key: set GEMINI_API_KEY or add gimini-key.txt');
}

async function main() {
  const imgPath = process.argv[2];
  if (!imgPath) {
    console.error('Usage: node tools/vision.js <imagePath> [prompt]');
    process.exit(1);
  }
  const prompt = process.argv[3] ||
    'Describe this image in detail. Focus on any products, brand names, ' +
    'UI text, error messages, and what is shown on screen.';

  const buf = fs.readFileSync(imgPath);
  const b64 = buf.toString('base64');
  const mime = /\.png$/i.test(imgPath) ? 'image/png'
    : /\.jpe?g$/i.test(imgPath) ? 'image/jpeg'
    : /\.webp$/i.test(imgPath) ? 'image/webp'
    : /\.gif$/i.test(imgPath) ? 'image/gif' : 'application/octet-stream';

  const key = loadKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mime, data: b64 } }
      ]
    }]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) {
    console.error('Gemini error', res.status, JSON.stringify(json).slice(0, 500));
    process.exit(1);
  }
  const text = (json.candidates && json.candidates[0] && json.candidates[0].content
    && json.candidates[0].content.parts.map(p => p.text).join('')) || '(no text returned)';
  console.log(text);
  try { fs.writeFileSync(path.join(__dirname, '..', '.vision-last.txt'), text); } catch (_) {}
}

main().catch(e => { console.error('ERR', e.message); process.exit(1); });
