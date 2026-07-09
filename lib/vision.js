// Google Cloud Vision API — image detection ("what is in this picture?").
// Uses WEB_DETECTION (Google's reverse-image knowledge), plus labels & logos.
// Needs an API key in config.json: { "googleVisionApiKey": "..." }
// Get one at https://console.cloud.google.com (enable "Cloud Vision API",
// create an API key). First 1,000 requests/month are free.
const https = require('https');

function detect(base64Image, apiKey) {
  const body = JSON.stringify({
    requests: [{
      image: { content: base64Image },
      features: [
        { type: 'WEB_DETECTION', maxResults: 10 },
        { type: 'LABEL_DETECTION', maxResults: 10 },
        { type: 'LOGO_DETECTION', maxResults: 5 }
      ]
    }]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      host: 'vision.googleapis.com',
      path: '/v1/images:annotate?key=' + encodeURIComponent(apiKey),
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
    }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          const r = (json.responses && json.responses[0]) || {};
          const web = r.webDetection || {};
          resolve({
            bestGuesses: (web.bestGuessLabels || []).map(x => x.label),
            entities: (web.webEntities || []).filter(x => x.description).map(x => x.description),
            labels: (r.labelAnnotations || []).map(x => x.description),
            logos: (r.logoAnnotations || []).map(x => x.description)
          });
        } catch (e) { reject(new Error('Vision API bad response: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Rank catalog products against detected terms.
// Uses brand, title, category, description, tags, details, and material for matching.
function rankProducts(products, detection) {
  const weighted = [
    ...detection.bestGuesses.map(t => [t, 5]),
    ...detection.logos.map(t => [t, 4]),
    ...detection.entities.map(t => [t, 2]),
    ...detection.labels.map(t => [t, 1])
  ];

  const scored = products.map(p => {
    const textFields = [
      p.brand || '',
      p.title || '',
      p.category || '',
      p.description || '',
      (p.tags || []).join(' '),
      (p.details && p.details.type) || '',
      (p.details && p.details.color) || '',
      p.material || ''
    ];
    const corpus = textFields.join(' ').toLowerCase();
    const corpusTokens = new Set(corpus.split(/[^a-z0-9+]+/).filter(t => t.length > 1));

    let score = 0;
    for (const [term, w] of weighted) {
      const tokens = term.toLowerCase().split(/[^a-z0-9+]+/).filter(t => t.length > 1);
      if (!tokens.length) continue;
      let hits = 0;
      for (const t of tokens) if (corpusTokens.has(t)) hits++;
      if (hits) {
        const ratio = hits / tokens.length;
        const bonus = hits > 1 ? hits : 1;
        score += w * ratio * bonus;
      }
    }

    const brand = (p.brand || '').toLowerCase();
    for (const [term] of weighted) {
      if (brand && term.toLowerCase().includes(brand)) {
        score += 3;
      }
    }

    return { product: p, score: Math.round(score * 10) / 10 };
  }).filter(x => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 6);
}

module.exports = { detect, rankProducts };
