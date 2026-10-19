# The Gifters Hub
Next.js 14 (frontend) + Express (backend).

## Run locally

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
5. After deployment, copy the service URL (for example, `https://gifter-hub-api.onrender.com`). Check that `<service-url>/health` returns `{"ok":true}`.

### Website on Vercel

1. Import the same GitHub repository as a new Vercel project.
2. Set **Root Directory** to `frontend`.
3. Add the environment variable `API_URL` with the Render service URL, without a trailing slash.
4. Deploy or redeploy after setting the environment variable.

- Product images: drop `<slug>.jpg` into `frontend/public/products/` (slugs are in `backend/data/products.json`). A monogram shows until then.
- Prices in products.json are seed values based on typical Indian listings; edit freely.
- Coupons: GIFTHUB10, UPI5, DIWALI100. Orders are kept in memory; swap for a database.
