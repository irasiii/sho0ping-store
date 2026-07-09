# sho0ping store — Shop by Picture

Web store where customers find a phone by **taking a picture of its barcode** (or live camera scan, or typing the code). Every product stores its details, current price, and **full price history**.

## Run it on your computer (Windows)

1. Install Node.js from https://nodejs.org (LTS version, one-time).
2. Open Command Prompt in this folder and run:
   ```
   npm install
   npm run seed
   npm start
   ```
3. Open **http://localhost:3000** in your browser.

The seed step loads 30 sample phones so you can demo everything today.

## Features

- **Catalog** — browse/search all phones with images, prices, barcodes.
- **Search by Picture** — 3 ways: live camera scan, upload any photo (barcode read instantly; otherwise **Google image detection** identifies the phone and shows best matches), or type the EAN/UPC.
- **Product page** — details + price history chart.
- **Price history** — every price change is recorded automatically with a timestamp.

## API

| Method | URL | Purpose |
|---|---|---|
| GET | `/api/products?q=` | list/search products |
| GET | `/api/products/:id` | product + price history |
| GET | `/api/barcode/:code` | find product by barcode |
| POST | `/api/products` | add/update a product |
| POST | `/api/products/:id/price` | record a new price |

Data lives in `data/db.json`.

## AI image search engines

Photo search runs up to three engines and combines their answers:

1. **Built-in AI (CLIP)** — always on, free, no account or key. Downloads its model (~120 MB) automatically on the first search, then cached in `data/models`.
2. **Claude Vision** (optional booster) — add `"anthropicApiKey"` to `config.json` (key from https://console.anthropic.com, paid).
3. **Google Vision** (optional booster) — add `"googleVisionApiKey"` to `config.json` (Google Cloud Console -> enable Cloud Vision API -> create API key; 1,000 images/month free).

Results show which engines matched each product. Without any key, the built-in engine plus barcode reading still give full picture search.

**Identify & auto-import:** if the photo shows something not in the catalog (e.g. a watch), the app names it ("Looks like: watch — Rolex Deepsea"), and when your Amazon API keys are configured it automatically searches Amazon, adds the top matching items to your database, and records today's price with the date (later imports with a new price add new dated records and keep the old ones).

## Connect real Amazon data (later)

1. Get an **Amazon Associates** account: https://affiliate-program.amazon.com (sign up, add payment/tax info). Note: Amazon requires 3 qualifying sales in 180 days to keep the account.
2. In Associates Central: **Tools → Product Advertising API → Join** to get your Access Key, Secret Key, and Partner Tag.
3. Copy `config.example.json` to `config.json` and paste the 3 keys.
4. Run `npm run sync` — it pulls real phone products (title, brand, image, price, barcode) from Amazon into your database.
5. Run it daily (Windows Task Scheduler) to build up price history automatically.

## Files

- `server.js` — web server + API
- `public/index.html` — the store UI
- `lib/db.js` — database with price-history logic
- `seed.js` — sample phone catalog
- `amazon-sync.js` — Amazon PA-API importer

## Real product photos

Double-click **Download-Photos.bat** (once, with internet). It downloads a real photo for every product into `public/images/` and switches the database to those local files — photos then load instantly and never break. Items imported from Amazon later get Amazon's official product photos automatically. Photos your admin uploads via "Add this item" are kept as-is.

## Use it on Android / iPhone (like a real app)

The store is a **PWA** — phones can install it with an icon, full screen, and a camera-first search:

1. **Put the store online** (required for phones): the easiest options are Render.com or Railway.app (free tiers, they run Node apps and give you an `https://...` address), or any server/VPS you rent. HTTPS comes automatically and is required for phone cameras.
2. On the phone, open your store address in Chrome (Android) or Safari (iPhone).
3. Android: tap the "Install app" prompt (or menu → Add to Home screen). iPhone: Share button → Add to Home Screen.
4. Open it from the icon — full screen, no browser bars. The **📷 Take a photo** button opens the phone camera directly; snapping a picture searches immediately.

Same Wi-Fi testing without hosting: run the store on your PC, find your PC's IP (`ipconfig` → IPv4), and open `http://YOUR-IP:3000` on the phone. Browsing, gallery upload, and the Take-a-photo button work; only the *live barcode video scan* needs HTTPS.

Later, if you want it in the App Store / Google Play like SHEIN, the same backend works — a React Native or Capacitor app wraps this store (Apple charges $99/year, Google $25 one-time).

## Deploy (Render / Railway)

The store is a standard Node app (`node server.js`), so it deploys from this repo with one click. Both hosts give you a free **HTTPS** URL — required for phone cameras and for installing the store as a PWA.

Repo: `https://github.com/irasiii/sho0ping-store`

- **Render** — New → **Blueprint** → connect the repo. Render reads `render.yaml` (free web service, `npm install` → `node server.js`, health check `/`) and deploys automatically. You get an `https://….onrender.com` URL.
- **Railway** — New Project → **Deploy from GitHub repo** → pick the repo. Railway uses `railway.json` (`npm` builder, `node server.js`, restart-on-failure, health check `/`) and gives you an `https://….up.railway.app` URL.

Notes:
- The **first image search downloads ~120 MB** for the built-in AI model (cached in `data/models/`, which is gitignored) — a short delay on first use after deploy.
- On free tiers the disk is **ephemeral** (resets on redeploy). Re-run `npm run seed` once after the first deploy for the catalog, or attach a disk/volume for persistence.
- Get the `https://…` URL on your phone, open it in Chrome (Android) / Safari (iPhone), and install it from the menu / Share sheet (see above).

## Next steps (when you're ready)

- Mobile app (the same API works as backend for iOS/Android)
- Photo search by product *appearance* (AI image matching), not just barcode
- Put the site online (needed for HTTPS camera access on phones and for the Associates application)
