# Siculera Workspace

This workspace contains two separate servers:

- `server.js` at the workspace root serves the root static site on `http://localhost:8080`
- `ecommerce/backend/server.js` is the ecommerce app and admin dashboard on `http://localhost:4000`

## Local URLs

- Storefront: `http://localhost:4000`
- Admin login: `http://localhost:4000/admin`
- Admin dashboard: `http://localhost:4000/admin/dashboard`

> If port `4000` is already in use, the app will fall back to `4001`.
> In that case, open `http://localhost:4001` and `http://localhost:4001/admin` instead.
>
> On Windows, embedded PostgreSQL may fail to start if the Visual C++ Redistributable is missing. If that happens, install the Microsoft Visual C++ 2015-2022 runtime, or set `USE_SYSTEM_POSTGRES=true` in `ecommerce/.env` if you already have local PostgreSQL installed.

## Start the ecommerce app in VS Code

Use the VS Code task:

- `Start Siculera Ecommerce`

Or use the launch configuration:

- `Launch Siculera Ecommerce`

If the embedded PostgreSQL startup fails on Windows, install the Microsoft Visual C++ Redistributable 2015-2022 or configure a local PostgreSQL server and enable it by setting `USE_SYSTEM_POSTGRES=true` in `ecommerce/.env`.

If you prefer the terminal, from the `ecommerce` folder run:

```bash
npm install
npm start
```

Then open `http://localhost:4000/admin` in your browser.

## Production Deployment

For the recommended production setup (Cloudflare Pages frontend + Render API backend + `api.siculera.com`):

- See `DEPLOY_BACKEND_RENDER_CLOUDFLARE.md`
