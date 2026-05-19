# Textile IMS V7 (Google Apps Script + Google Sheets)

This repository contains a production-ready **Inventory Management System (IMS)** for textile operations, built for Google Sheets as data source and Google Apps Script as backend/web app.

## What this system includes

- Inventory + stock health dashboard
- Order Book with status lifecycle
- Job Work tracking (sent/received/wastage/payment)
- Dispatch log with challan and vehicle tracking
- Procurement planner (recommended buy quantities)
- Worker performance leaderboard
- KPI analytics (fulfilment, late orders, dispatch trend, wastage)
- Audit log for every write action
- Settings + role-based write controls (open/restricted)

---

## Files

- `Code.gs` -> Apps Script backend
- `Index.html` -> Web app frontend

---

## Sheet structure (required tabs)

Create these sheets in your Google Spreadsheet:

1. `Master`
2. `Order Book`
3. `Job Work Tracker`
4. `Dispatch Log`

System will auto-create:

5. `Audit Log`
6. `Settings`

### Suggested headers

#### Master

`ItemCode | ItemName | Category | WeightMtr | OpeningStock | TotalInMtrKG | TotalOutMtrKG | ClosingBalance | AllocatedtoOrders | ReorderStatus | ReorderLevel | LeadTimeDays | PreferredVendor`

#### Order Book

`OrderID | Date | ClientName | ItemCode | OrderedQtyMtrKG | Status | DueDate | Priority | Remarks`

#### Job Work Tracker

`Date | JobID | OrderID | WorkerName | ItemCode | SentQtyMtr | ReceivedQtyMtr | WastageMtr | Status | RatePerMtr | TotalPayment`

#### Dispatch Log

`DispatchID | OrderID | ClientName | ItemCode | DispatchedQty | DispatchDate | ChallanNo | VehicleNo`

---

## Deploy in Google Apps Script (manual method)

1. Open your target Google Sheet.
2. Go to **Extensions -> Apps Script**.
3. Replace existing code with:
   - `Code.gs` content into script file
   - `Index.html` content into HTML file named `Index`
4. Save project.
5. Run `onOpen` once (for first-time setup permissions).
6. Go to **Deploy -> New deployment -> Web app**:
   - Execute as: your account
   - Who has access: as per your org policy
7. Deploy and open web app URL.

---

## Deploy using clasp (optional)

```bash
npm install -g @google/clasp
clasp login
clasp create --type sheets --title "Textile IMS V7"
clasp push
```

Then deploy from Apps Script UI.

---

## Settings controls

Use `Settings` sheet:

- `WRITE_MODE`: `OPEN` or `RESTRICTED`
- `WRITE_ALLOWLIST`: comma-separated emails
- `ADMIN_ALLOWLIST`: comma-separated emails
- `PAYMENT_RATE_PER_MTR`: default auto-payment rate for job work
- `WASTAGE_ALERT_PCT`: threshold for worker performance penalty
- `DEFAULT_LEAD_TIME_DAYS`: procurement planning lead time fallback

---

## Important operational note

When `WRITE_MODE=RESTRICTED`, write actions are allowed only for users in `WRITE_ALLOWLIST` or `ADMIN_ALLOWLIST`.

---

## Next recommended upgrades

- SMS/WhatsApp alerts for low stock and overdue orders
- E-way bill and invoicing integration
- Barcode/QR inward-outward scanning
- Fabric lot/batch traceability with quality tags
- Multi-warehouse stock transfer workflows

