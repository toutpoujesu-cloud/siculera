# Deploy Backend API (Render) + Connect Domain (Cloudflare)

This guide brings back chat and API features for the live Pages frontend.

## 1) Deploy API on Render

1. Open Render dashboard.
2. Click `New` -> `Blueprint` (recommended).
3. Connect GitHub repo: `toutpoujesu-cloud/siculera`.
4. Render will detect `render.yaml` in repo root.
5. Create service.

### Service settings from render.yaml
- Service name: `siculera-api`
- Root directory: `ecommerce`
- Build command: `npm install`
- Start command: `npm start`

## 2) Set required environment variables in Render

Set these in Render service -> Environment:

- `DATABASE_URL` = your production Postgres URL
- `JWT_SECRET` = 64-byte random secret
- `DATA_ENCRYPTION_KEY` = 32-byte random hex key
- `DEEPSEEK_API_KEY` = your rotated key

Already prefilled by blueprint (can be edited):
- `NODE_ENV=production`
- `USE_SYSTEM_POSTGRES=true`
- `FRONTEND_URL=https://www.siculera.com`
- `ALLOWED_ORIGINS=https://www.siculera.com,https://siculera.com`

## 3) Verify backend health

After deployment finishes, open:
- `https://<your-render-service>.onrender.com/health`

Expected: JSON with status `ok`.

## 4) Connect `api.siculera.com` in Cloudflare

1. Cloudflare -> DNS -> Add record.
2. Type: `CNAME`
3. Name: `api`
4. Target: `<your-render-service>.onrender.com`
5. Proxy status: `Proxied` (orange cloud)
6. Save.

## 5) Validate production API

Check:
- `https://api.siculera.com/health`

Then test chat from storefront:
- `https://www.siculera.com`

## 6) Notes

- Frontend is already configured to use `https://api.siculera.com` in production.
- Local dev still uses `http://localhost:4000`.
- If CORS error appears, confirm Render env var `ALLOWED_ORIGINS` includes both:
  - `https://www.siculera.com`
  - `https://siculera.com`
