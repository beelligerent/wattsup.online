# WattsUp Energy Intelligence — Next.js

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture

- **Framework**: Next.js 15 (App Router)
- **Rendering**: Client-side only (SPA via `dynamic(() => import(...), { ssr: false })`)
  - All pages are protected behind Azure MSAL authentication
  - No public pages requiring SSR
- **API Routes**: `app/api/` — replace the previous Express `server.ts`
- **Auth**: Azure MSAL Browser (initialized once in `ClientApp.tsx`)
- **State**: Zustand + `PreloadService` (loads all data from Cosmos on login)
- **Database**: Azure Cosmos DB (via API routes in `app/api/cosmos/`)

## Environment Variables

Copy `.env.example` to `.env.local`:

| Variable | Where used |
|---|---|
| `COSMOS_ENDPOINT` | Server (API routes) only |
| `COSMOS_KEY` | Server (API routes) only |
| `COSMOS_DATABASE_ID` | Server (API routes) only |
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | Client (MSAL auth) |
| `NEXT_PUBLIC_AZURE_TENANT_ID` | Client (MSAL auth) |
| `NEXT_PUBLIC_AZURE_TENANT_NAME` | Client (MSAL auth) |
| `NEXT_PUBLIC_AZURE_REDIRECT_URI` | Client (MSAL auth) |
| `NEXT_PUBLIC_AZURE_STORAGE_*` | Client (Blob Storage) |
| `NEXT_PUBLIC_GEMINI_API_KEY` | Client (AI features) |

## Migration from Vite

The key changes from the previous Vite + Express setup:

1. `server.ts` → `app/api/` route handlers
2. `import.meta.env.VITE_*` → `process.env.NEXT_PUBLIC_*`
3. `react-router-dom` → tab-state navigation in `ClientApp.tsx`
4. `main.tsx` + `App.tsx` → `app/page.tsx` + `src/ClientApp.tsx`
5. `vite.config.ts` → `next.config.ts`
