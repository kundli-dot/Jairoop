# AGENTS.md

## Project Overview

Jai Roop Textiles — Inventory Management System (IMS) v7.0. A full-stack Next.js 16 web application for textile inventory, order, job-work, and dispatch management.

The `main` branch contains only reference PDFs. The runnable application lives on the `cursor/ims-textile-system-24e3` branch inside the `ims/` directory.

## Cursor Cloud specific instructions

### Branch & Working Directory

- All development happens on the `cursor/ims-textile-system-24e3` branch (or branches based on it).
- The application root is `/workspace/ims/` — run all commands from there.

### Running the Application

```bash
cd /workspace/ims
npm run dev          # starts Next.js dev server on localhost:3000
```

### Database

- SQLite via Prisma + LibSQL adapter; no external DB server needed.
- DB file lives at `ims/prisma/dev.db`.
- Migrate: `npx prisma migrate dev` (from `ims/` directory)
- Seed sample data (after dev server is running): `curl -X POST http://localhost:3000/api/seed`

### Lint / Build / Test

- Lint: `npm run lint` (ESLint; pre-existing `react-hooks/set-state-in-effect` errors exist in current code)
- Build: `npm run build`
- No automated test suite exists yet.

### Known Issues

- Sidebar navigation keys (`stock`, `orders`) don't match `TAB_TITLES` keys (`inventory`, `orderbook`) in `src/app/page.tsx`, causing a runtime error when switching tabs. Dashboard tab works correctly.

### Environment Variables

- Copy `.env.example` to `.env` — only `DATABASE_URL="file:./prisma/dev.db"` is needed.
- The `prisma.config.ts` reads `DATABASE_URL` from env; `src/lib/db.ts` constructs the path directly from `process.cwd()`.
