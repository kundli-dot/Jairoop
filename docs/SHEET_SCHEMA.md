# Google Sheet Schema

## Master

| Column | Header (example) | Notes |
|--------|------------------|-------|
| A | Item Code | Primary key |
| B | Item Name | Description |
| C | Category | e.g. Satin, Georgette |
| D | Weight/Mtr | |
| E | Opening Stock | |
| F | Total In (Mtr/KG) | Updated by stock IN |
| G | Total Out (Mtr/KG) | Updated by stock OUT |
| H | Closing Balance | Usually formula-driven |
| I | Allocated to Orders | Auto-synced from Order Book |
| J | Reorder Status | e.g. REORDER (LOW), NORMAL |

## Order Book

| Column | Field |
|--------|-------|
| A | Order ID |
| B | Date |
| C | Client Name |
| D | Item Code |
| E | Ordered Qty (Mtr/KG) |
| F | Status |
| G | Remarks |

Status values: `Pending`, `In Production`, `Completed`

## Job Work Tracker

| Column | Field |
|--------|-------|
| A | Date |
| B | Job ID |
| C | Order ID |
| D | Worker Name |
| E | Item Code |
| F | Sent Qty (Mtr) |
| G | Received Qty (Mtr) |
| H | Wastage (Mtr) |
| I | Status |
| J | Total Payment |

## Dispatch Log

| Column | Field |
|--------|-------|
| A | Dispatch ID |
| B | Order ID |
| C | Client Name |
| D | Item Code |
| E | Dispatched Qty |
| F | Dispatch Date |
| G | Challan No. |

## Stock Movements (V7 — auto-created)

| Column | Field |
|--------|-------|
| A | Move ID |
| B | Date |
| C | Item Code |
| D | Type |
| E | Qty (Mtr/KG) |
| F | Reference |
| G | Remarks |

Type values: `IN`, `OUT`
