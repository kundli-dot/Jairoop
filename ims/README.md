# Jai Roop Textiles — IMS (Inventory Management System) v7.0

A comprehensive, production-grade Inventory Management System built for **Jai Roop Textiles**. This system manages the complete lifecycle of textile inventory — from stock tracking through order management, job work production, and dispatch.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, TypeScript)
- **Database**: SQLite via [Prisma ORM](https://prisma.io/) v7 + LibSQL adapter
- **UI**: [Tailwind CSS](https://tailwindcss.com/) with dark mode support
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)

## Features

### Dashboard
- Real-time KPI cards (reorder alerts, active orders, job work batches, dispatch volume, fulfilment rate, wastage %)
- Interactive charts: stock by category, order status split, top items by balance, monthly dispatch trends
- Critical reorder alerts banner

### Stock / Inventory
- Full inventory table with search, category filter, and stock status filter
- Visual stock health bars with progress indicators
- Reorder status badges (REORDER / LOW / NORMAL)
- Allocated-to-orders tracking
- Add new inventory items via modal

### Order Book
- Complete order management with status tracking (Pending → In Production → Completed)
- Search and status filters
- Create new orders with auto-generated IDs
- Inline status change via dropdown
- **Order Lifecycle View** — visual timeline showing order placement, job work, dispatch, and completion

### Job Work Tracker
- Track material sent to workers for processing
- Automatic balance calculation (sent - received)
- **Wastage analysis** with critical threshold flagging (>4%)
- Payment tracking at configurable rates (default ₹0.25/Mtr)
- Worker-based filtering

### Dispatch Log
- Record all dispatches with challan numbers, vehicle details, and transport info
- Auto-update inventory on dispatch
- Option to mark linked orders as completed on dispatch
- **Print Challan** feature for delivery documentation
- Volume and record count summary

### Client Portfolios
- Client-wise order history with summary cards
- Total ordered, dispatched, and completion metrics
- Visual order cards with status indicators

### Stock Alerts
- Automatic detection of critical stock levels
- Three alert tiers: Critical (below min), Warning (>80% allocated), Info (approaching min)
- Actionable alert cards with stock metrics

### Additional Features
- **Dark Mode** toggle
- **Responsive design** for desktop use
- **Activity logging** for audit trail
- **Auto-generated IDs** for orders, job work, and dispatches

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
cd ims
npm install
```

### Database Setup

```bash
npx prisma migrate dev
```

### Start Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Seed Sample Data

After starting the server, seed the database with sample data:

```bash
curl -X POST http://localhost:3000/api/seed
```

## Project Structure

```
ims/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Migration files
│   └── dev.db                 # SQLite database
├── src/
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   ├── dashboard/     # KPI & analytics data
│   │   │   ├── inventory/     # Stock CRUD
│   │   │   ├── orders/        # Order management + lifecycle
│   │   │   ├── jobwork/       # Job work tracking
│   │   │   ├── dispatch/      # Dispatch logging
│   │   │   ├── clients/       # Client portfolios
│   │   │   ├── alerts/        # Stock alerts
│   │   │   └── seed/          # Database seeding
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Main SPA page
│   ├── components/
│   │   ├── Dashboard.tsx      # KPI cards & charts
│   │   ├── Inventory.tsx      # Stock management table
│   │   ├── OrderBook.tsx      # Order tracking & lifecycle
│   │   ├── JobWorkTracker.tsx  # Production tracking
│   │   ├── DispatchLog.tsx    # Dispatch & challan management
│   │   ├── ClientPortfolios.tsx # Client-wise views
│   │   ├── StockAlerts.tsx    # Alert dashboard
│   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   ├── Header.tsx         # Top header bar
│   │   └── Loader.tsx         # Loading screen
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   └── utils.ts           # Utility functions
│   └── generated/prisma/      # Generated Prisma client
├── package.json
└── tsconfig.json
```

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/dashboard` | GET | KPIs, analytics, chart data |
| `/api/inventory` | GET | List items (search, category, status filters) |
| `/api/inventory` | POST | Create new inventory item |
| `/api/inventory` | PUT | Update inventory item |
| `/api/orders` | GET | List orders (search, status filters) |
| `/api/orders` | POST | Create new order |
| `/api/orders` | PUT | Update order (status change) |
| `/api/orders/[orderId]/lifecycle` | GET | Order lifecycle with job work & dispatch |
| `/api/jobwork` | GET | List job work entries |
| `/api/jobwork` | POST | Create job work entry |
| `/api/jobwork` | PUT | Update job work entry |
| `/api/dispatch` | GET | List dispatches |
| `/api/dispatch` | POST | Log new dispatch |
| `/api/clients` | GET | List clients, or client portfolio details |
| `/api/alerts` | GET | Stock alerts |
| `/api/seed` | POST | Seed database with sample data |

## Google Sheets Integration

This system is designed as a standalone replacement for the original Google Apps Script-based IMS. The data model matches the Google Sheet structure:

| Sheet Tab | Database Table |
|---|---|
| Master | `inventory_items` |
| Order Book | `orders` |
| Job Work Tracker | `job_works` |
| Dispatch Log | `dispatches` |

## License

Private — Jai Roop Textiles
