# FMS Google Apps Script — WhatsApp Integration

## Files in This Repository

| File | Purpose | Trigger type |
|---|---|---|
| `WhatsApp.gs` | Auto-sends WhatsApp to HODs when a Planned Date appears | **onChange** (instant) + **Time-based** (hourly backup) |
| `FMSAutofill.gs` | Company → Person cascading dropdown autofill | **onEdit** (simple) |

> Your existing `Code.gs` (with `onChange_new`, `onOpen`, TAT formulas, etc.) is **not touched**.

---

## Why onEdit Doesn't Work for Planned Dates

Your planned date cells are populated by **formulas** (e.g. `WORKDAY.INTL`, `IF`, etc.).

| Trigger | Fires when… | Works for formula cells? |
|---|---|---|
| `onEdit` | User directly types in a cell | ❌ No |
| **`onChange` (installable)** | ANY change to spreadsheet content | ✅ Yes |
| **Time-based** | Every X minutes/hours | ✅ Yes |

Both an `onChange` installable trigger AND a 60-minute backup trigger are installed by `setupWhatsAppTriggers()`.

---

## Bug That Was Fixed (v2)

**`HOD_NAME_ROW` was set to `2` — this pointed at the flow name ("BOM"), not the HOD's name.**

The sheet header structure for flow columns is:

| Sheet Row | Col A label | Flow column content |
|---|---|---|
| 2 | What | Flow name → **BOM** / CRM / System … |
| **3** | **Who** | **HOD name → Sumit Mishra** ← correct row |
| 4 | How | System / … |
| 5 | When | 24:00:00 |
| 6 | — | Column headers (PI, Act, Status, Form Link, …) |
| 7+ | — | Data rows |

With `HOD_NAME_ROW: 2`, the script read "BOM", looked it up in the HOD sheet, found nothing, and silently skipped every row. Fixed to `HOD_NAME_ROW: 3`.

---

## How WhatsApp.gs Works

1. **onChange trigger** → fires within seconds of any sheet change (including formula recalculations that generate planned dates)
2. **Hourly backup trigger** → catches anything the onChange might have missed
3. Both call `checkAndSendWhatsApp()` which:
   - Batch-reads the entire FMS sheet in one call
   - Checks all 8 flow blocks per row for populated Planned Dates
   - Looks up HOD name from row 3 of that flow's column → finds their phone in HOD sheet
   - Sends WhatsApp: Task ID + Item + Customer + Planned Date + Form Link
   - Logs to **WA_Log** sheet — each Task ID + Flow is notified **exactly once**

---

## Sheet Structure

### FMS flow blocks (starting column Q)

| Flow | Columns | HOD name location |
|---|---|---|
| Flow 1 | Q–U (17–21) | **Q3** |
| Flow 2 | V–Z (22–26) | **V3** |
| Flow 3 | AA–AE (27–31) | **AA3** |
| Flow 4 | AF–AJ (32–36) | **AF3** |
| Flow 5 | AK–AO (37–41) | **AK3** |
| Flow 6 | AP–AT (42–46) | **AP3** |
| Flow 7 | AU–AY (47–51) | **AU3** |
| Flow 8 | AZ–BD (52–56) | **AZ3** |

Within each 5-column block:

| Offset | Content |
|---|---|
| +0 | Planned Date (PI) ← triggers WhatsApp |
| +1 | Actual Date (Act) |
| +2 | Status |
| +3 | **Form Link** ← sent in message |
| +4 | Time Delay |

### HOD Sheet

| Column A | Column B |
|---|---|
| HOD Name (exact match with row 3 of FMS) | Phone — international format, no `+`, no spaces |
| Sumit Mishra | 919876543210 |

---

## Setup — Step by Step

### Step 1 — Add files to Apps Script
1. Open your Google Sheet → **Extensions → Apps Script**
2. Click **+** next to Files → name it `WhatsApp` → paste `WhatsApp.gs`
3. Add another file `FMSAutofill` → paste `FMSAutofill.gs` *(skip if already in project)*

### Step 2 — Verify WA_CFG
- `FMS_SHEET` and `HOD_SHEET` must match your sheet tab names exactly
- `HOD_NAME_ROW: 3` ← must stay 3
- `TASK_ID_COL` — run `diagnoseFMSSheet()` to confirm

### Step 3 — Run setup (once)
Select **`setupWhatsAppTriggers`** → Run → grant permissions

### Step 4 — Run the diagnostic
Select `diagnoseFMSSheet` → Run → check Execution Log:
- Confirm HOD names read per flow match names in HOD sheet
- Confirm Task IDs are being read from the right column
- Adjust `WA_CFG` column numbers if anything looks wrong

### Step 5 — Test the API
Edit `testWhatsAppSend()` with a real phone → Run → check that phone receives the test message

### Step 6 — Verify triggers
Triggers panel (clock icon) should show:
- `onChange_WhatsApp` — From spreadsheet / On change
- `checkAndSendWhatsApp` — Time-driven / Every hour
- Your existing `onChange_new` — leave it alone

---

## Utility Functions

| Function | Purpose |
|---|---|
| `setupWhatsAppTriggers()` | Install both triggers (run once) |
| `removeWhatsAppTriggers()` | Pause all WhatsApp notifications |
| `checkAndSendWhatsApp()` | Run a manual scan right now |
| `diagnoseFMSSheet()` | Log what the script is reading — use to verify config |
| `testWhatsAppSend()` | Send a test message to verify API |
| `clearWASentLog()` | Reset log (next run re-sends everything — use with caution) |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| No messages ever | HOD_NAME_ROW wrong | Run `diagnoseFMSSheet()` — check HOD names read per flow |
| No messages ever | Trigger not installed | Run `setupWhatsAppTriggers()` |
| HOD not found in log | Name mismatch | Names must match exactly (no extra spaces) |
| Wrong task details | Wrong column numbers | Run `diagnoseFMSSheet()` and adjust `WA_CFG` |
| Same message re-sent | WA_Log rows deleted | Never delete rows from WA_Log |
| Delay of ~1 hour | onChange trigger missing | Re-run `setupWhatsAppTriggers()` |

---

## API Credentials

| Parameter | Value |
|---|---|
| Endpoint | `POST https://yourdigisathi.in/api/whatsapp-web/send-message` |
| `app_key` | `c0a32d45-887c-48a7-8a35-1977773f0ebb` |
| `auth_key` | `abcJnOSJ7zs71D110EXwaS9OkuuS9bEI11` |
