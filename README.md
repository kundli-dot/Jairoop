# Jai Roop Textiles — IMS V7

**Advanced Inventory Management System**  
A full-stack, production-ready IMS for textile manufacturers — built on Python FastAPI + SQLite + single-page HTML dashboard.

---

## Features

### 12 Fully Functional Modules
| Module | What It Does |
|--------|-------------|
| **Dashboard** | Live KPIs (8 cards), 4 analytics charts, reorder & recent-order panels |
| **Inventory** | Full CRUD, stock adjustments, movement history, category/status filters, pagination, CSV export |
| **Purchase Orders** | Create POs from suppliers, receive goods (auto-updates stock), partial receipt tracking |
| **Suppliers** | Supplier database with contact info, GSTIN, PO history |
| **Order Book** | Full order lifecycle with priority/status, value calculation, lifecycle timeline |
| **Job Work Tracker** | Worker-batch tracking, wastage analysis, auto-payment calculation, critical wastage alerts |
| **Dispatch Log** | Dispatch logging, printable delivery challan, today/month filtering |
| **Clients** | Client CRM with order portfolio, total metrics per client |
| **Workers** | Worker profiles with performance stats — jobs, sent/received, wastage, total payment |
| **Reports** | 6 report types (Stock, Orders, Dispatch, Worker Payments, Reorder List, Client Statement) with CSV download |
| **Alerts** | Critical reorder + 80%-allocated warnings with quick PO creation |
| **Settings** | Company profile, wastage threshold, payment rates, financial year config |

### Additional Capabilities
- **Global Search** (Ctrl+K) — search across inventory, orders, clients, workers instantly
- **Dark Mode** toggle
- **Keyboard Shortcuts** — Ctrl+K search, Escape to close modals
- **Pagination** — all tables have 25/50/100 per page controls
- **Column Sorting** — click headers to sort
- **Print-ready Challan** — professional delivery challan with your company header
- **Real seed data** — 100 actual SKUs imported from your Google Sheets
- **Activity Log** — every add/update/delete is recorded

---

## Quick Start

### Prerequisites
- Python 3.8+

### Run
```bash
chmod +x start.sh
./start.sh
```

Or manually:
```bash
pip install -r requirements.txt
python3 app.py
```

Open **http://localhost:8000** in your browser.

---

## Stack
- **Backend**: FastAPI (Python) — REST API with full CRUD
- **Database**: SQLite (zero-config, stored in `data/ims.db`)
- **Frontend**: Vanilla JS SPA with Chart.js — no build step needed
- **Design**: DM Sans font, dark navy sidebar, gold accent (`#c9a84c`)

---

## Data Structure

### Sheets → API Modules
| Google Sheets Tab | API Endpoint | Frontend Tab |
|-------------------|-------------|--------------|
| Master | `/api/inventory` | Stock / Inventory |
| Order Book | `/api/orders` | Order Book |
| Job Work Tracker | `/api/jobwork` | Job Work Tracker |
| Dispatch Log | `/api/dispatch` | Dispatch Log |
| *(new)* | `/api/purchase-orders` | Purchase Orders |
| *(new)* | `/api/suppliers` | Suppliers |
| *(new)* | `/api/workers` | Workers |
| *(new)* | `/api/clients` | Clients |

---

## Importing Your Google Sheets Data

The system is pre-seeded with all 100 SKUs from your Google Sheets. To refresh or add more:

1. Export your Google Sheet as CSV
2. Use the API directly:
   ```
   POST /api/inventory   — add new items
   PUT  /api/inventory/{item_code} — update existing
   POST /api/inventory/adjustment  — adjust stock quantities
   ```

---

## API Reference

All endpoints return JSON. Full list at **http://localhost:8000/docs** (Swagger UI).

### Key Endpoints
```
GET  /api/inventory           List all stock items
POST /api/inventory           Add new item
PUT  /api/inventory/{code}    Update item
POST /api/inventory/adjustment  Stock IN/OUT adjustment

GET  /api/orders              List orders
POST /api/orders              Create order
PUT  /api/orders/{id}         Update/change status

GET  /api/jobwork             List job work
POST /api/jobwork             Log new job work

GET  /api/dispatch            List dispatches
POST /api/dispatch            Log new dispatch (auto-updates stock)

GET  /api/purchase-orders     List POs
POST /api/purchase-orders     Create PO
PUT  /api/purchase-orders/{id}/receive  Receive goods

GET  /api/kpis                Dashboard analytics
GET  /api/alerts              Reorder & allocation alerts
GET  /api/reports/{type}?fmt=csv  Download report as CSV
```

---

## Deploying to Production

The app can be deployed to any Linux server:

```bash
# Install
pip install -r requirements.txt gunicorn

# Run with Gunicorn (production)
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

For persistent deployment, add a `systemd` service or use Docker.

---

*Built for Jai Roop Textiles — IMS V7 Corporate Edition*
