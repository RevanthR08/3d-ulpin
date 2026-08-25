# VERTICA portal (`portal-web`)

Premium Citizen / Operator SPA for PS 26011 (3D ULPIN).

## Commands (pnpm only)

```bash
cd code/portal-web
pnpm install
pnpm dev          # http://127.0.0.1:5173/portal/  (proxies API to :8000)
pnpm build        # → code/app/staticportal/
```

With FastAPI running, open **http://127.0.0.1:8000/portal/** after `pnpm build`.

## Demo login

- **Citizen** — any username/password → citizen workspace
- **Operator** — any username/password → admin command / ingest / AI / validation
