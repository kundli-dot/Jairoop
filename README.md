# FMS Google Apps Script — WhatsApp Integration

## What This Script Does

1. **Company → Person cascading dropdown** on the `FMS` sheet (columns B, C, D, E).
2. **Auto-sends a WhatsApp message** to the responsible HOD whenever a **Planned Date (PI)** is entered in any flow block column.

---

## Sheet Structure Expected

| Sheet | Purpose |
|-------|---------|
| `FMS` | Main flow management sheet (contains flow columns from Q onward) |
| `Master` | Lookup table: Column A = Company, B = Person, C = Details, D = Email |
| `HOD` | HOD directory: Column A = HOD Name, Column B = WhatsApp phone number |

### Flow Block Layout (repeating every 5 columns, starting at column Q)

| Column Offset | Column (Flow 1) | Content |
|---|---|---|
| +0 | Q (col 17) | Planned Date (PI) ← **triggers WhatsApp** |
| +1 | R (col 18) | Actual Date (Act) |
| +2 | S (col 19) | Status |
| +3 | T (col 20) | Form Link |
| +4 | U (col 21) | Time Delay |

Flow blocks repeat:
- Flow 1 → Q–U (cols 17–21), HOD name in **Q2**
- Flow 2 → V–Z (cols 22–26), HOD name in **V2**
- Flow 3 → AA–AE (cols 27–31), HOD name in **AA2**
- Flow 4 → AF–AJ (cols 32–36), HOD name in **AF2**
- Flow 5 → AK–AO (cols 37–41), HOD name in **AK2**
- Flow 6 → AP–AT (cols 42–46), HOD name in **AP2**
- Flow 7 → AU–AY (cols 47–51), HOD name in **AU2**
- Flow 8 → AZ–BD (cols 52–56), HOD name in **AZ2**

### HOD Sheet Format

| Column A | Column B |
|---|---|
| HOD Name | WhatsApp Number (international format, no + or spaces) |
| Rahul Sharma | 919876543210 |
| Priya Singh | 918765432109 |

> Phone numbers must be in **international format without `+`**, e.g., `919876543210` for India.

---

## Setup Instructions

### Step 1 — Open Apps Script Editor
1. Open your Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Delete any existing code in `Code.gs`.
4. Paste the entire content of `Code.gs` from this repo.

### Step 2 — Configure the script (if needed)
The top of `Code.gs` has a `CFG` object. Verify these match your sheet:

```javascript
var CFG = {
  FMS_SHEET:    "FMS",      // ← Your flow sheet name
  MASTER_SHEET: "Master",   // ← Your master data sheet name
  HOD_SHEET:    "HOD",      // ← Your HOD directory sheet name
  ...
};
```

If your flow table is on a **different sheet** (not `FMS`), change `CFG.FMS_SHEET` to that sheet's name in **both** the `onEdit` checks.

### Step 3 — Set up the trigger
The script uses a simple `onEdit` trigger which fires automatically when any cell is edited. **No manual trigger setup needed** — just save the script and it's active.

> **Note:** `UrlFetchApp` (used for WhatsApp API calls) requires the script to be saved and authorized. On the first run you'll be asked to grant permission — click **Allow**.

### Step 4 — Test the WhatsApp connection
1. In the Apps Script editor, select the function `testWhatsAppSend` from the dropdown.
2. Edit the phone number in the function to a number you can verify.
3. Click **Run** and check the **Logs** (View → Logs).

---

## WhatsApp Message Format

When a Planned Date is entered, the HOD receives:

```
Dear [HOD Name],

A new task has been planned for you in the FMS system (Flow X).

Task ID      : [from column O]
Item Name    : [from column G]
Customer     : [from column B]
Planned Date : [the date just entered]

Please complete the form using the link below:
[Google Form link from column T / column +3 of this flow block]

Regards,
FMS System
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| WhatsApp not sent | Check **Logs** in Apps Script editor for error details |
| HOD not found | Ensure HOD name in row 2 of the flow sheet **exactly matches** name in HOD sheet (no extra spaces) |
| Wrong phone dialled | Verify HOD sheet column B has numbers in format `91XXXXXXXXXX` (no +, no spaces) |
| Form link missing | Ensure the Form Link cell (col T or +3 offset) is filled before or at same time as Planned Date |
| `onEdit` not firing | Confirm the script is saved and authorised; `onEdit` only fires on **manual** edits, not formula recalculations |

---

## API Credentials Used

| Parameter | Value |
|---|---|
| API URL | `https://yourdigisathi.in/api/whatsapp-web/send-message` |
| `app_key` | `c0a32d45-887c-48a7-8a35-1977773f0ebb` |
| `auth_key` | `abcJnOSJ7zs71D110EXwaS9OkuuS9bEI11` |
