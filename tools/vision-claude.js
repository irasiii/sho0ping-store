// Claude (Anthropic) vision helper: describe an image and return text.
// Usage: node tools/vision-claude.js <imagePath> [prompt]
// Reads the API key from ANTHROPIC_API_KEY, else claude-key.txt in repo root.
// Writes the description to stdout and .vision-last.txt.
const fs = require('fs');
const path = require('path');

const MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';

function loadKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY.trim();
  for (const name of ['claude-key.txt', 'claude-key', '.claude-key']) {
    const p = path.join(__dirname, '..', name);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  }
  throw new Error('No Anthropic key: set ANTHROPIC_API_KEY or add claude-key.txt');
}

async function main() {
  const imgPath = process.argv[2];
  if (!imgPath) {
    console.error('Usage: node tools/vision-claude.js <imagePath> [prompt]');
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
  const body = {
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
        { type: 'text', text: prompt }
      ]
    }]
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  if (!res.ok) {
    console.error('Claude error', res.status, JSON.stringify(json).slice(0, 500));
    process.exit(1);
  }
  const text = (json.content || []).map(p => p.text).join('');
  console.log(text);
  try { fs.writeFileSync(path.join(__dirname, '..', '.vision-last.txt'), text); } catch (_) {}
}

main().catch(e => { console.error('ERR', e.message); process.exit(1); });
