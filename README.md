# sho0ping store — Shop by Picture

Web store where customers find a product by **taking a picture of it** (or of its barcode) (or live camera scan, or typing the code). Every product stores its details, current price, and **full price history**.

## Run it on your computer (Windows)

1. Install Node.js from https://nodejs.org (LTS version, one-time).
2. Open Command Prompt in this folder and run:
   ```
   npm install
   npm run seed
   npm start
   ```
3. Open **http://localhost:3000** in your browser.

The seed step loads the sample catalog (shoes, ladies bags and accessories, ~90 items with real product photos) so you can demo everything today.

## Features

- **Catalog** — browse/search all products with images, prices, barcodes.
- **Search by Picture** — 3 ways: live camera scan, upload any photo (barcode read instantly; otherwise **Google image detection** identifies the product and shows best matches), or type the EAN/UPC.
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
4. Run `npm run sync` — it pulls real products (title, brand, image, price, barcode) from Amazon into your database.
5. Run it daily (Windows Task Scheduler) to build up price history automatically.

## Files

- `server.js` — web server + API
- `public/index.html` — the store UI
- `lib/db.js` — database with price-history logic
- `seed.js` — sample catalog (shoes + bags + accessories)
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

## Run on Linux (self-host / VPS)

The app is cross-platform Node.js (no Windows-specific code). On a Linux box:

**One command** (the Linux twin of Start-Store.bat — installs/repairs dependencies, seeds the catalog on first run, prints the LAN URLs for your phone, starts the server):

```bash
git clone https://github.com/irasiii/sho0ping-store.git
cd sho0ping-store
bash start-store.sh          # or: chmod +x start-store.sh && ./start-store.sh
```

Extras: `./start-store.sh stop` stops it, `./start-store.sh seed` reloads the sample catalog, `PORT=8080 ./start-store.sh` uses another port.

Or step by step:

```bash
git clone https://github.com/irasiii/sho0ping-store.git
cd sho0ping-store
npm install
npm run seed      # one-time: load the catalog
npm start         # node server.js  →  http://localhost:3000
```

Make sure the `data/` directory is writable by the user running the app (it creates `db.json`, `users.json` and downloads the AI model into `data/models/` on first use).

**Keep it alive with pm2** (simple, no root needed):
```bash
npm install -g pm2
pm2 start server.js --name sho0ping
pm2 save && pm2 startup   # auto-restart on boot
```

**Or as a systemd service** (create `/etc/systemd/system/sho0ping.service`):
```ini
[Unit]
Description=sho0ping store
After=network.target

[Service]
WorkingDirectory=/opt/sho0ping-store
ExecStart=/usr/bin/node server.js
Restart=on-failure
User=www-data
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```
Then: `sudo systemctl daemon-reload && sudo systemctl enable --now sho0ping`

First image search downloads ~120 MB for the built-in AI model — the host needs outbound internet on first use.

## Run with Docker

A `Dockerfile` (Node 18 slim) and `docker-compose.yml` are included. `.dockerignore` keeps `node_modules`, `data/` and the local token file out of the image.

**One command** — builds the image, starts the container, seeds the catalog into the volume on first run, and prints the URLs:

```bash
./start-store.sh docker      # then: ./start-store.sh logs | stop | seed
```

Or step by step:

```bash
# Build and start
docker compose up -d --build

# Load the catalog (one-time; writes into the persisted volume)
docker compose exec app npm run seed

# Open it
xdg-open http://localhost:3000   # or just visit http://localhost:3000
```

Without Compose, plain Docker also works:

```bash
docker build -t sho0ping-store .
docker run -d -p 3000:3000 -v sho0ping-data:/app/data --name sho0ping sho0ping-store
docker exec sho0ping npm run seed
```

Notes:
- Data lives in the `appdata` volume (Compose) or `sho0ping-data` volume (plain) and survives restarts.
- First image search downloads ~120 MB for the built-in AI model into the volume — needs outbound internet on first use.
- The server listens on `PORT` (default 3000); map it as needed.

## Next steps (when you're ready)

- Mobile app (the same API works as backend for iOS/Android)
- Photo search by product *appearance* (AI image matching), not just barcode
- Put the site online (needed for HTTPS camera access on phones and for the Associates application)
