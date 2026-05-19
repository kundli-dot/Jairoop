# Jai Roop Textiles — IMS V7 (Enterprise Edition)

A Google-Sheets-backed Inventory Management System for textile manufacturers, deployed as a Google Apps Script Web App. V7 is a substantial upgrade over V6 — same data, more power.

## What V7 adds over V6

| Area | V6 | V7 |
|---|---|---|
| Modules | 4 (Master, Orders, Job Work, Dispatch) | 11 (+ Purchase Orders, Vendors, Clients, Workers, Payments, Stock Ledger, Audit Log, Users, Settings) |
| Frontend files | 1 monolithic HTML | 3 modular (`Index.html`, `Stylesheet.html`, `JavaScript.html`) |
| Auth | None | Google identity + role-based PIN (`ADMIN/MANAGER/STAFF/VIEWER`) |
| Invoices | — | GST Tax Invoice PDF generator (auto-stored to Drive folder) |
| Challans | — | Delivery challan PDF generator |
| Analytics | KPIs + 4 charts | + ABC analysis, stock aging, reorder point math, demand forecast, worker scoreboard, receivables/payables |
| Notifications | — | Daily email digest (cron), WhatsApp `wa.me` links, order confirmation email |
| Audit | — | Every write logged with user, timestamp, payload |
| Backup | — | One-click ZIP-of-CSV backup to Drive |
| Settings | Hard-coded | Editable from UI (`Settings` tab) — company profile, GST, accent colour, etc. |
| Global search | — | Header search jumps to first matching tab |
| Mobile | OK | Sidebar auto-collapses to icons on < 900 px |

## Repo layout

```
apps-script/
├── appsscript.json        # manifest with OAuth scopes & timezone
├── Code.gs                # entry point, CRUD for Orders / Jobs / Dispatch / POs
├── SetupSheets.gs         # one-click provisioning of all sheets & columns
├── Auth.gs                # PIN-based role guard
├── Audit.gs               # writes Audit Log
├── Analytics.gs           # ABC / aging / reorder math / forecast / scoreboards
├── Notifications.gs       # daily digest, WhatsApp deep-links, email confirmations
├── Invoice.gs             # GST invoice + challan PDF generators
├── Index.html             # main HTML shell + modals
├── Stylesheet.html        # all CSS (included via <?!= include ?>)
└── JavaScript.html        # all client JS (included via <?!= include ?>)
docs/
└── deployment.md          # extra screenshots & gotchas
```

## Deployment (one-time, ~15 min)

### 1. Open your sheet
Open the Google Sheet (the one from your link) and choose **Extensions → Apps Script**. Delete the existing `Code.gs` and `Index.html` from V6 (your data stays intact).

### 2. Create files in the editor
For each file under `apps-script/`, click the **+** next to *Files* in the Apps Script editor:
- For `.gs` files, choose **Script**; paste contents.
- For `.html` files, choose **HTML**; paste contents (drop the `.html` from the filename: Apps Script adds it automatically).
- For `appsscript.json`, click the **gear icon → "Show appsscript.json manifest file"**, then paste.

Save (Ctrl/Cmd+S) after each.

### 3. Provision the data sheets
From the editor, choose **Run → setupAll**. Authorise the scopes when prompted. This:
- creates any missing sheets (`Purchase Orders`, `Vendors`, `Clients`, `Workers`, `Payments`, `Stock Ledger`, `Audit Log`, `Users`, `Settings`)
- adds any missing columns to existing V6 sheets (`Master`, `Order Book`, `Job Work Tracker`, `Dispatch Log`) — your data is untouched
- seeds the `Settings` tab with defaults
- adds you as the first **ADMIN** user with PIN **`1234`**

Re-run any time — it is idempotent.

### 4. Deploy the web app
**Deploy → New deployment → Type: Web app**

- *Description*: `IMS V7 Enterprise`
- *Execute as*: **Me**
- *Who has access*: **Anyone in <your-domain>** (recommended) or **Anyone**
- Click **Deploy**, authorise.

Copy the **Web app URL** and bookmark it. That's your IMS dashboard.

### 5. First login
1. Open the URL.
2. Your Google email shows up — enter PIN **`1234`** to enter.
3. Go to **Settings** → change company name, GSTIN, address, phone, logo Drive file ID, accent colour, default GST %, job-work rate.
4. Go to the Google Sheet → `Users` tab → change your PIN, add staff (one row each: email, name, role, pin, Active=Yes).

### 6. (Optional) Install daily email digest
**Settings → Daily Email Digest** → enter recipient email + hour → **Install/Update Daily Trigger**.

You can also click **Send Test Now** to preview the digest immediately.

## Day-to-day workflows

### Sales order → cash, end-to-end
1. **Order Book → New Order** — enter client, item, qty, rate, advance. (Auto: total value, balance due, allocation against stock.)
2. **Job Work → Add Job Work** — when fabric goes to a worker. Wastage > 4 % is flagged automatically.
3. **Dispatch → Log Dispatch** — capture challan, transporter, vehicle, LR no. Tick *Mark linked order as Completed*.
4. **Order Book → "eye" icon → Generate Invoice** — produces a branded GST PDF, stored in Drive folder *IMS Invoices*, shareable link returned.
5. **Payments → Record Payment** — log advance/balance receipt. Receivables & Payables tab auto-updates.

### Procurement
1. **Purchase Orders → New PO** — vendor, item, qty, rate, GST %.
2. When goods arrive, click **Receive** → stock auto-flows into Master (`TotalIn` increases) **and** a row is appended to **Stock Ledger** for aging.

### Reports tab (the gold mine)
- **ABC Analysis** — flags top-value items (A/B/C) so you know where to focus.
- **Reorder Suggestions** — uses *average daily consumption × 14-day lead time + 7-day safety* to recommend exact reorder quantity.
- **Stock Aging** — buckets stock 0–30 / 31–60 / 61–90 / 90+ days from Stock Ledger.
- **Worker Scoreboard** — wastage %, completion %, total paid — ranks workers.
- **Demand Forecast** — 3-month moving average per item.

### WhatsApp shortcut
Anywhere a phone number is shown (Clients/Vendors/Workers tabs), the green WhatsApp icon opens `wa.me/91...` with a pre-filled message. No paid API; uses the device's WhatsApp.

## Permissions matrix

| Role | Read | Write | Payments | Invoice | Settings | Delete |
|---|---|---|---|---|---|---|
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| MANAGER | ✓ | ✓ | ✓ | ✓ | – | – |
| STAFF | ✓ | ✓ | – | – | – | – |
| VIEWER | ✓ | – | – | – | – | – |

Set the role per user in the `Users` sheet (column C). PIN is column D. Set column E (`Active`) to anything other than `Yes` to disable a user.

## Backups
Settings → **Export Backup ZIP** — bundles every sheet as CSV, drops the zip in Drive folder *IMS Backups*. Schedule yourself a monthly reminder, or extend `Notifications.gs` to do it automatically.

## Security notes
- The PIN is **a soft lock**, not cryptographic — it stops accidental clicks by colleagues who share a screen, but Google identity is the real gate.
- For external (non-domain) access, change *Who has access* during deployment to **Anyone**. PINs become more important then.
- Web app is deployed as `executeAs: USER_DEPLOYING` — every write happens under your Google account.
- The `Audit Log` sheet shows who did what, when, with payload.

## Roadmap ideas (easy follow-ups)
- Barcode/QR per item, scanned via phone camera (`html5-qrcode`)
- TallyPrime XML export for accountants
- E-way bill JSON generator (NIC API)
- Multi-warehouse: add `WarehouseID` column on `Stock Ledger` + filter
- Inline editable cells in tables (use `contenteditable`)
- Cost & margin per order (already have CostPerMtr in Master)
- SLA timer on Job Work rows (highlight when ExpectedReturn past)
- Push notifications via Firebase / OneSignal

## Migrating from V6
Your existing rows in `Master`, `Order Book`, `Job Work Tracker`, `Dispatch Log` work as-is. `setupAll()` only **adds** columns — never reorders, never deletes. The frontend renders new columns when present and falls back to `—` when blank. Backfill at your own pace.

## Troubleshooting
- *"Permission denied"* toast — your Google account isn't in the `Users` sheet, or the role's perms are too low. Open the sheet → add yourself.
- *Logo doesn't show* — Settings → `company.logoFileId` must be a Drive file ID of an image, and the file must be set to *Anyone with link can view*.
- *Invoice PDF blank* — make sure the order has a `RatePerMtr` and the matched `ItemCode` exists in `Master` with `SellingPricePerMtr` and `GSTPct`.
- *Daily digest not sending* — `Settings → alert.recipientEmail` is empty, or you didn't click *Install/Update Daily Trigger*. Apps Script → Triggers tab shows whether `sendDailyDigest` is scheduled.

---

Built with care for Jai Roop Textiles. Questions? Tweak any `.gs`/`.html` file directly in the Apps Script editor — everything is plain JavaScript and HTML.
