# Google Sheet layout for Textile IMS

Bind the Apps Script project to the same spreadsheet that holds your data. The script expects **four tabs** with these **exact names**:

| Tab name            | Purpose                          |
|---------------------|----------------------------------|
| `Master`            | Item master + stock + reorder    |
| `Order Book`        | Customer orders                  |
| `Job Work Tracker`  | Material sent/received to workers |
| `Dispatch Log`      | Outbound dispatches + challan    |

Row **1** on each tab must be **headers**. The script turns headers into keys by removing spaces and punctuation (e.g. `Total In (Mtr/KG)` → `TotalInMtrKG`). Use the labels below so the dashboard matches your fields.

## Master

Recommended column order (you may add extra columns to the right; do not remove the core ones the team uses in formulas):

| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| Item Code | Item Name | Color | Category | Weight/Mtr | Opening Stock | Total In (Mtr/KG) | Total Out (Mtr/KG) | Allocated to Orders | Closing Balance | Reorder Status |

**Allocated to Orders:** If this column is missing, the script **adds it as a new rightmost column** on first allocation sync so it never overwrites `Closing Balance`. You can also insert it manually between **Total Out** and **Closing Balance** to match the dashboard table order.

`Reorder Status` values used in the UI include: `REORDER (LOW)`, `NORMAL`, `ABOVE LEVEL` (match your sheet formulas).

## Order Book

| Order ID | Date | Client Name | Item Code | Ordered Qty (Mtr/KG) | Status | Remarks |

- **Status** must be exactly: `Pending`, `In Production`, or `Completed` (for KPIs and badges).
- **Column F (Status)** is the trigger column for `onEdit` → allocation sync to Master.
- New rows from the web app append: Order ID (auto), Date, Client, Item Code, Qty, Status, Remarks.

**Item Code** here should match **Item Code** on `Master` so allocations roll up correctly.

## Job Work Tracker

| Date | Job ID | Order ID | Worker Name | Item Code | Sent Qty Mtr | Received Qty Mtr | Wastage Mtr | Status | Total Payment |

- **Status:** `Out` or `Completed` (others still work but KPIs treat `Out` as “live batches”).
- Job ID is filled by the script on append.

## Dispatch Log

| Dispatch ID | Order ID | Client Name | Item Code | Dispatched Qty | Dispatch Date | Challan No |

- Dispatch ID is auto-generated on append.
- If “Mark linked order as Completed” is checked in the web app, **Status** on that order in Order Book is set to `Completed`.

## Link to your existing workbook

Your workbook: [IMS System V2 spreadsheet](https://docs.google.com/spreadsheets/d/19DMKtsGlL2GvDAZSW7tfJ8S-8Vi_vk0dka_IG-hIbWw/edit?usp=sharing)

1. Confirm tab names match the four names above (rename if needed).
2. Confirm header row text matches (small differences change the JSON keys the dashboard reads).
3. In the spreadsheet: **Extensions → Apps Script** → paste `Code.gs` and add an HTML file named **Index** (filename `Index.html` in the editor UI is shown as **Index**).
4. **Deploy → New deployment** → type **Web app** → Execute as **Me** → Who has access: your choice (often “Anyone within organisation” or “Anyone with the link” for shop-floor tablets—balance with your security policy).

Optional logo: **Project Settings → Script properties** → add `LOGO_FILE_ID` = Google Drive file ID of a PNG/JPG logo.
