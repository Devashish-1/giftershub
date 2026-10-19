# The Gifters Hub
Next.js 14 (frontend) + Express (backend).

## Run locally

Copy `backend/.env.example` to `backend/.env` and set the MongoDB Atlas connection URI before starting the API. Keep the URI private; `.env` files are ignored by Git.

    cd backend
    npm install
    npm run dev

In another terminal:

    cd frontend
    npm install
    npm run dev

The frontend runs at `http://localhost:3000`; the API runs at `http://localhost:3001`.

## Deploy

### API on Render

1. Create a **Web Service** from this GitHub repository.
2. Set **Root Directory** to `backend`.
3. Set **Build Command** to `npm install`.
4. Set **Start Command** to `HOST=0.0.0.0 npm start`.
5. Add `MONGODB_URI` and `MONGODB_DB_NAME=gifters_hub` to the Render service's Environment settings. Set `NODE_ENV=production` so account cookies are secure.
6. After deployment, copy the service URL (for example, `https://gifter-hub-api.onrender.com`). Check that `<service-url>/health` returns `{"ok":true,"database":"connected"}`.

### MongoDB Atlas

Create a free M0 cluster, then create a database user with read/write access only to the `gifters_hub` database. Add the Render service's outbound IPs to Atlas Network Access when available; if the free Render instance does not provide stable outbound IPs, Atlas may require `0.0.0.0/0`. In that case, use a unique, strong database-user password and the least-privilege database role. Copy the driver's SRV connection string into Render's `MONGODB_URI` secret; never commit it or put it in frontend variables.

At startup, the API creates the required indexes and synchronizes the product catalog seed from `backend/data/products.json` into MongoDB. Users, scrypt-hashed passwords, sessions, and orders are stored in MongoDB. Session cookies are HTTP-only, same-site, and expire after seven days. Authentication and order endpoints return an explicit unavailable response until Atlas is connected.

### Website on Vercel

1. Import the same GitHub repository as a new Vercel project.
2. Set **Root Directory** to `frontend`.
3. Add the environment variable `API_URL` with the Render service URL, without a trailing slash.
4. Deploy or redeploy after setting the environment variable.

- Product images: drop `<slug>.jpg` into `frontend/public/products/` (slugs are in `backend/data/products.json`). A monogram shows until then.
- Prices in products.json are seed values based on typical Indian listings; edit freely.
- Coupons: GIFTHUB10, UPI5, DIWALI100.

### Product image credits

The Commons photos below are illustrative visuals, not guaranteed photographs of the exact items being sold. Files are stored in `frontend/public/products/` and shown under the following free licenses:

- `karungali-*.jpg`, `rudraksha-bracelet-5mukhi.jpg`: [Rudraksha mala](https://commons.wikimedia.org/wiki/File:Rudraksha_mala.jpg), Janak Bhatta, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- `hanuman-dashboard-murti.jpg`: [Hanuman idol, Bhumapura Hanuman Temple](https://commons.wikimedia.org/wiki/File:Hanuman_idol,_Bhumapura_Hanuman_Temple,_Gujarat.jpg), Hittucciex4, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- `ganesha-dashboard-murti.jpg`: [Murti of Lord Ganesha](https://commons.wikimedia.org/wiki/File:Murti_of_lord_Ganesha.jpg), Anushka10patel, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- `krishna-laddu-gopal.jpg`: [Silver-plated blue Laddu Gopal](https://commons.wikimedia.org/wiki/File:Silver-plated-blue-Laddu-Gopal-idol-baby-Krishna-crawling.jpg), HanumanSevak2025, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- `brass-diya-set.jpg`: [Indian Arati diya](https://commons.wikimedia.org/wiki/File:Indian_Arati_diya.jpg), Amitbsws, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- `pooja-thali-gift-box.jpg`: [Diwali Pooja Thali with Diya Decoration](https://commons.wikimedia.org/wiki/File:Diwali_Pooja_Thali_with_Diya_Decoration.jpg), Fitindia, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- `diwali-hamper-premium.jpg`: [Hindu pooja thali](https://commons.wikimedia.org/wiki/File:Hindu_pooja_thali.jpg), suketdedhia, [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
- `shiva-trishul-damru-idol.jpg`: [Shiva Nataraja at the Museum Rietberg](https://commons.wikimedia.org/wiki/File:Shiva_Nataraja_Museum_Rietberg_RVI_501.jpg), photograph by Andreas Praefcke, public domain.
- `lakshmi-ganesh-pair.jpg`: [Ganesh Murti - Traditional Idol of Lord Ganesha](https://commons.wikimedia.org/wiki/File:Ganesh_Murti_-_Traditional_Idol_of_Lord_Ganesha_018.jpg), Shoot stufz, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
