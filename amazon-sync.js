// Amazon Product Advertising API 5.0 sync.
// Pulls mobile phone products (title, brand, image, price, barcode/EAN, ASIN)
// into the local database, recording price history on every run.
//
// SETUP:
//   1. Copy config.example.json to config.json
//   2. Fill in accessKey, secretKey, partnerTag from Amazon Associates Central
//      (Tools -> Product Advertising API)
//   3. Run: npm run sync
//
// Run it daily (Windows Task Scheduler) to build up price history.
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');

const CONFIG_FILE = path.join(__dirname, 'config.json');
if (!fs.existsSync(CONFIG_FILE)) {
  console.error('Missing config.json — copy config.example.json to config.json and add your Amazon PA-API keys.');
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
for (const k of ['accessKey', 'secretKey', 'partnerTag']) {
  if (!cfg[k] || cfg[k].startsWith('YOUR_')) {
    console.error(`config.json: please set "${k}".`);
    process.exit(1);
  }
}

// Marketplace hosts/regions: https://webservices.amazon.com/paapi5/documentation/locale-reference.html
const HOST = cfg.host || 'webservices.amazon.com';   // US
const REGION = cfg.region || 'us-east-1';
const MARKETPLACE = cfg.marketplace || 'www.amazon.com';

function sign(key, msg) { return crypto.createHmac('sha256', key).update(msg).digest(); }
function hash(msg) { return crypto.createHash('sha256').update(msg).digest('hex'); }

function paapiRequest(operation, payload) {
  const service = 'ProductAdvertisingAPI';
  const target = `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`;
  const uriPath = `/paapi5/${operation.toLowerCase()}`;
  const body = JSON.stringify(payload);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
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
          if (res.statusCode !== 200 || json.Errors) {
            reject(new Error(`PA-API ${res.statusCode}: ${JSON.stringify(json.Errors || json)}`));
          } else resolve(json);
        } catch (e) { reject(new Error(`PA-API bad response: ${data.slice(0, 300)}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function searchPhones(keywords, page) {
  return paapiRequest('SearchItems', {
    Keywords: keywords,
    SearchIndex: cfg.searchIndex || 'All',
    BrowseNodeId: cfg.browseNodeId || undefined, // optional: cell phones category node
    ItemPage: page,
    ItemCount: 10,
    PartnerTag: cfg.partnerTag,
    PartnerType: 'Associates',
    Marketplace: MARKETPLACE,
    Resources: [
      'ItemInfo.Title',
      'ItemInfo.ByLineInfo',
      'ItemInfo.ExternalIds',
      'Images.Primary.Large',
      'Offers.Listings.Price'
    ]
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
    currency: (listing && listing.Price && listing.Price.Currency) || 'USD'
  };
}

(async () => {
  const keywordSets = cfg.keywords || ['smartphone unlocked', 'mobile phone', 'iphone', 'samsung galaxy phone'];
  const pages = cfg.pagesPerKeyword || 2; // PA-API allows up to 10 pages (100 items) per search
  const d = db.load();
  let count = 0;

  for (const kw of keywordSets) {
    for (let page = 1; page <= pages; page++) {
      try {
        const res = await searchPhones(kw, page);
        const items = (res.SearchResult && res.SearchResult.Items) || [];
        for (const item of items) {
          const p = extract(item);
          if (!p.title || p.price == null) continue;
          db.upsertProduct(d, p);
          count++;
        }
        console.log(`"${kw}" page ${page}: ${items.length} items`);
        await new Promise(r => setTimeout(r, 1100)); // respect 1 req/sec limit
      } catch (e) {
        console.error(`"${kw}" page ${page} failed: ${e.message}`);
      }
    }
  }

  db.save(d);
  console.log(`Done. ${count} products added/updated. Price changes recorded in history.`);
})();
