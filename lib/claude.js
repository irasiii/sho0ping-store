// Claude Vision engine — asks Anthropic's Claude what phone is in the photo.
// Needs "anthropicApiKey" in config.json (from https://console.anthropic.com).
const https = require('https');

function detectPhone(base64Image, mediaType, apiKey, model) {
  const body = JSON.stringify({
    model: model || 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: base64Image } },
        { type: 'text', text: "Identify the product in this image. Reply with ONLY the brand and model/product name, e.g. 'Samsung Galaxy S24 Ultra' or 'Rolex Deepsea watch'. If unsure of the exact model, give brand and closest guess. If there is no product, reply exactly: none" }
      ]
    }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      host: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          const text = ((json.content && json.content[0] && json.content[0].text) || '').trim();
          resolve(text.toLowerCase() === 'none' ? '' : text);
        } catch (e) { reject(new Error('Claude API bad response: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { detectPhone };
