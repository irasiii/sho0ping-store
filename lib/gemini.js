// Google Gemini vision engine (from the VisuSearch app).
// Free API key from https://aistudio.google.com/apikey — generous free tier.
// config.json: { "geminiApiKey": "AIza..." }
const https = require('https');

function detectProduct(base64Image, mediaType, apiKey, model) {
  const body = JSON.stringify({
    contents: [{
      parts: [
        { inline_data: { mime_type: mediaType || 'image/jpeg', data: base64Image } },
        { text: "Identify the product in this image. Reply with ONLY the brand and model/product name, e.g. 'Nike Air Max 270' or 'Rolex Deepsea watch'. If unsure of the exact model, give brand and closest guess. If there is no product, reply exactly: none" }
      ]
    }]
  });
  const m = model || 'gemini-2.0-flash';

  return new Promise((resolve, reject) => {
    const req = https.request({
      host: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${m}:generateContent?key=${encodeURIComponent(apiKey)}`,
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          const text = ((((json.candidates || [])[0] || {}).content || {}).parts || [])
            .map(p => p.text || '').join(' ').trim();
          resolve(text.toLowerCase() === 'none' ? '' : text);
        } catch (e) { reject(new Error('Gemini bad response: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { detectProduct };
