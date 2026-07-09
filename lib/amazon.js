// Amazon PA-API product search (used to auto-import identified items).
// Reuses the same signed-request approach as amazon-sync.js.
const crypto = require('crypto');
const https = require('https');

function sign(key, msg) { return crypto.createHmac('sha256', key).update(msg).digest(); }
function hash(msg) { return crypto.createHash('sha256').update(msg).digest('hex'); }

function hasKeys(cfg) {
  return ['accessKey', 'secretKey', 'partnerTag'].every(k => cfg[k] && !String(cfg[k]).startsWith('YOUR_'));
}

function request(cfg, operation, payload) {
  const HOST = cfg.host || 'webservices.amazon.com';
  const REGION = cfg.region || 'us-east-1';
  const service = 'ProductAdvertisingAPI';
  const target = `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`;
  const uriPath = `/paapi5/${operation.toLowerCase()}`;
  const body = JSON.stringify(payload);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const headers = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    host: HOST,
    'x-amz-date': amzDate,
    'x-amz-target': target
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('');
  const canonicalRequest = ['POST', uriPath, '', canonicalHeaders, signedHeaders, hash(body)].join('\n');
  const scope = `${dateStamp}/${REGION}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, hash(canonicalRequest)].join('\n');
  let k = sign('AWS4' + cfg.secretKey, dateStamp);
  k = sign(k, REGION); k = sign(k, service); k = sign(k, 'aws4_request');
  const signature = crypto.createHmac('sha256', k).update(stringToSign).digest('hex');
  headers['Authorization'] =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const req = https.request({ host: HOST, path: uriPath, method: 'POST', headers }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode !== 200 || json.Errors) reject(new Error(JSON.stringify(json.Errors || json)));
          else resolve(json);
        } catch (e) { reject(new Error('PA-API bad response: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function extract(item) {
  const ext = item.ItemInfo && item.ItemInfo.ExternalIds;
  const barcode =
    (ext && ext.EANs && ext.EANs.DisplayValues && ext.EANs.DisplayValues[0]) ||
    (ext && ext.UPCs && ext.UPCs.DisplayValues && ext.UPCs.DisplayValues[0]) || '';
  const listing = item.Offers && item.Offers.Listings && item.Offers.Listings[0];
  return {
    asin: item.ASIN,
    title: item.ItemInfo && item.ItemInfo.Title && item.ItemInfo.Title.DisplayValue,
    brand: (item.ItemInfo && item.ItemInfo.ByLineInfo && item.ItemInfo.ByLineInfo.Brand &&
            item.ItemInfo.ByLineInfo.Brand.DisplayValue) || '',
    image: item.Images && item.Images.Primary && item.Images.Primary.Large && item.Images.Primary.Large.URL,
    barcode,
    price: listing && listing.Price && listing.Price.Amount,
    msrp: (listing && listing.SavingBasis && listing.SavingBasis.Amount) || null,
    description: ((item.ItemInfo && item.ItemInfo.Features && item.ItemInfo.Features.DisplayValues) || []).slice(0, 3).join(' '),
    currency: (listing && listing.Price && listing.Price.Currency) || 'USD'
  };
}

// Search Amazon for a product name, return up to `count` clean items.
async function searchAmazon(keywords, cfg, count = 3) {
  const res = await request(cfg, 'SearchItems', {
    Keywords: keywords,
    SearchIndex: 'All',
    ItemCount: Math.min(count * 2, 10),
    PartnerTag: cfg.partnerTag,
    PartnerType: 'Associates',
    Marketplace: cfg.marketplace || 'www.amazon.com',
    Resources: [
      'ItemInfo.Title', 'ItemInfo.ByLineInfo', 'ItemInfo.ExternalIds', 'ItemInfo.Features',
      'Images.Primary.Large', 'Offers.Listings.Price', 'Offers.Listings.SavingBasis'
    ]
  });
  const items = ((res.SearchResult && res.SearchResult.Items) || [])
    .map(extract)
    .filter(p => p.title && p.price != null)
    .slice(0, count);
  return items;
}

module.exports = { searchAmazon, hasKeys };
