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
7. For Google sign-in, add `FIREBASE_PROJECT_ID` and the Firebase Admin service-account JSON as `FIREBASE_SERVICE_ACCOUNT_JSON` in Render's Environment settings. Keep the service-account value private.
8. To create the first administrator, set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 16 characters. The API creates the account on startup; after it exists, the password variable can be removed. Never use a shared or default password.

### MongoDB Atlas

Create a free M0 cluster, then create a database user with read/write access only to the `gifters_hub` database. Add the Render service's outbound IPs to Atlas Network Access when available; if the free Render instance does not provide stable outbound IPs, Atlas may require `0.0.0.0/0`. In that case, use a unique, strong database-user password and the least-privilege database role. Copy the driver's SRV connection string into Render's `MONGODB_URI` secret; never commit it or put it in frontend variables.

At startup, the API creates the required indexes and synchronizes the product catalog seed from `backend/data/products.json` into MongoDB. Product records no longer present in that seed are removed from the `products` collection; user accounts, sessions, and orders are not changed. Users, scrypt-hashed passwords, sessions, and orders are stored in MongoDB. Session cookies are HTTP-only, same-site, and expire after seven days. Authentication and order endpoints return an explicit unavailable response until Atlas is connected.

### Website on Vercel

1. Import the same GitHub repository as a new Vercel project.
2. Set **Root Directory** to `frontend`.
3. Add the environment variable `API_URL` with the Render service URL, without a trailing slash.
4. Add `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID` from the Firebase Web app settings. These client values are public; do not put the Admin service-account key in Vercel's client variables.
5. Enable **Google** in Firebase Authentication's sign-in providers and add the site's production and admin domains to Firebase's authorized domains.
6. Deploy or redeploy after setting the environment variables.

- Email/password sign-in is available. Google sign-in uses Firebase for identity verification and the API's HTTP-only MongoDB session for the app. It remains unavailable until Firebase Web config and the API service-account secret are set.
- The administrator dashboard is available at `/admin`. To use `admin.example.com`, attach that hostname to the Vercel project and configure its DNS. Requests to the admin hostname are routed to the dashboard. Set `COOKIE_DOMAIN=.example.com` on the API only if sessions should be shared across subdomains.
- Admins can review paginated customer and order records and update order/payment statuses. Online payment collection is not implemented; payment status is an operational record only.
- Phone sign-in and online payment collection are not enabled.
- The Terms & Conditions and Privacy Policy are available at `/terms` and `/privacy`.
- The 66 product listings are sourced from the provided catalogue PDF. Retail prices were not included, so listings are marked “Price coming soon” and cannot be ordered until retail prices are confirmed.
- To make an item purchasable, set its `price` and `mrp` in `backend/data/products.json`, then set `available` to `true` and `status` to `active`. The API seeds MongoDB from this file on startup.
- Product photos and finish views were extracted from the provided catalogue PDF and stored as optimized WebP files in `frontend/public/products/`.
