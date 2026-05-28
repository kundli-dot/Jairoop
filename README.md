# FMS Google Apps Script — WhatsApp Integration

## Files in This Repository

| File | Purpose | Trigger type |
|---|---|---|
| `WhatsApp.gs` | Auto-sends WhatsApp to HODs when a Planned Date appears | **Time-based** (hourly) |
| `FMSAutofill.gs` | Company → Person cascading dropdown autofill | **onEdit** (simple) |

> Your existing `Code.gs` (the one with `onChange_new`, `onOpen`, TAT formulas, etc.) is **not touched**. These two new files live alongside it in the same Apps Script project.

---

## Why onEdit Doesn't Work for Planned Dates

Your planned date cells are populated by **formulas** (e.g. `=IF(...)`, `WORKDAY.INTL(...)`, etc.).

| Trigger | Fires when… | Works for formula cells? |
|---|---|---|
| `onEdit` | User directly types in a cell | ❌ No |
| `onChange` | Any structural change | ❌ No |
| **Time-based** | Every X minutes/hours | ✅ Yes |

`onEdit` and `onChange` only fire on *user-initiated* direct edits. Formula recalculations are invisible to both. This is why your previous WhatsApp attempts produced no messages.

---

## How WhatsApp.gs Works

1. A **time-based trigger** calls `checkAndSendWhatsApp()` every hour.
2. It batch-reads the entire FMS sheet in one API call (fast, won't time out).
3. For every task row, it checks each of the 8 flow blocks for a populated Planned Date.
4. It looks up the HOD name (from row 2 of that flow's column) in the **HOD sheet** to get their phone number.
5. It sends a WhatsApp message with Task ID, Item Name, Customer, Planned Date, and the Form Link.
6. Every successful send is recorded in a sheet called **WA_Log** — so each task+flow combination is sent **only once**, no matter how many times the trigger runs.

---

## Sheet Structure Required

### FMS Sheet — flow block layout

| Flow | Columns | HOD name location |
|---|---|---|
| Flow 1 | Q–U (cols 17–21) | Q2 |
| Flow 2 | V–Z (cols 22–26) | V2 |
| Flow 3 | AA–AE (cols 27–31) | AA2 |
| Flow 4 | AF–AJ (cols 32–36) | AF2 |
| Flow 5 | AK–AO (cols 37–41) | AK2 |
| Flow 6 | AP–AT (cols 42–46) | AP2 |
| Flow 7 | AU–AY (cols 47–51) | AU2 |
| Flow 8 | AZ–BD (cols 52–56) | AZ2 |

Within each 5-column block:

| Offset | Column (example Flow 1) | Content |
|---|---|---|
| +0 | Q | Planned Date (PI) |
| +1 | R | Actual Date (Act) |
| +2 | S | Status |
| +3 | T | **Form Link** ← sent in WhatsApp |
| +4 | U | Time Delay |

### HOD Sheet

| Column A | Column B |
|---|---|
| HOD Name (must match exactly what is in row 2 of FMS) | WhatsApp number — international format, no `+`, no spaces |
| Rahul Sharma | 919876543210 |
| Priya Singh | 918765432109 |

> Indian numbers: prefix `91` followed by the 10-digit mobile number.

### WA_Log Sheet (auto-created)

Created automatically the first time `setupWhatsAppTrigger()` runs. Columns:

| Task ID | Flow # | HOD Name | Phone | Planned Date | Sent At |

**Never delete rows from WA_Log** unless you want messages to be re-sent.

---

## Setup — Step by Step

### Step 1 — Add files to your Apps Script project
1. Open your Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Click the **+** next to "Files" to add a new script file.
4. Name it `WhatsApp` and paste the full contents of `WhatsApp.gs`.
5. Add another file named `FMSAutofill` and paste `FMSAutofill.gs`.
   - **Skip this step** if you already have the `onEdit` autofill logic in your project.

### Step 2 — Verify configuration
Open `WhatsApp.gs` and check the `WA_CFG` block at the top:
- `FMS_SHEET` — must match your flow tracking sheet's tab name exactly
- `HOD_SHEET` — must match your HOD directory sheet's tab name exactly
- Column numbers — adjust if your layout differs from the defaults

### Step 3 — Run setup (once only)
1. In the Apps Script editor, select `setupWhatsAppTrigger` from the function dropdown.
2. Click **Run**.
3. Grant permissions when prompted (the script needs access to the spreadsheet and internet for the API).
4. Check the **Execution log** — you should see: `✅ WhatsApp trigger installed. Runs every 1 hour(s).`
5. You will also see a new **WA_Log** tab appear in your spreadsheet.

### Step 4 — Test the API
1. Open `WhatsApp.gs`, find `testWhatsAppSend()`.
2. Replace `"91XXXXXXXXXX"` with a real phone number you can verify.
3. Select `testWhatsAppSend` from the dropdown and click **Run**.
4. Check **Execution log** for `✅ Test message sent successfully!`
5. Check that phone for the WhatsApp message.

### Step 5 — Verify the trigger exists
1. In Apps Script, click the **clock icon** (Triggers) in the left sidebar.
2. You should see `checkAndSendWhatsApp` listed with type `Time-driven`, interval `1 hour`.
3. You will also still see your existing `onChange_new` trigger — leave it alone.

---

## WhatsApp Message Format

```
Dear [HOD Name],

A new task has been assigned to you in FMS (Flow X).

Task ID      : TASK-001
Item         : Product Name
Customer     : Customer Name
Planned Date : 28/05/2026 10:00

Please fill the Google Form:
https://forms.gle/your-form-link

Regards,
FMS System
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No messages ever sent | Trigger not installed | Run `setupWhatsAppTrigger()` |
| `testWhatsAppSend` fails | Wrong API credentials or phone format | Verify credentials in `WA_CFG`; phone must be `91XXXXXXXXXX` |
| HOD not found in log | Name mismatch between FMS row 2 and HOD sheet col A | Remove extra spaces; names must match exactly |
| Message sent but not received | Wrong phone number format | Use digits only, no `+`, no dashes, no spaces |
| Same message sent multiple times | WA_Log was cleared or rows were deleted | Check WA_Log sheet; never delete its rows |
| Trigger runs but skips some rows | Planned date column is blank (formula returned `""`) | Normal — those rows are skipped until the date populates |

---

## Utility Functions

| Function | How to use | What it does |
|---|---|---|
| `setupWhatsAppTrigger()` | Run once from editor | Installs the hourly trigger |
| `removeWhatsAppTrigger()` | Run from editor to pause | Stops future automatic runs |
| `checkAndSendWhatsApp()` | Run manually to test | Runs a full scan right now |
| `testWhatsAppSend()` | Run from editor | Sends a test message to a number you specify |
| `clearWASentLog()` | **Use with caution** | Clears WA_Log — next run will re-send all messages |

---

## API Credentials

| Parameter | Value |
|---|---|
| Endpoint | `POST https://yourdigisathi.in/api/whatsapp-web/send-message` |
| `app_key` | `c0a32d45-887c-48a7-8a35-1977773f0ebb` |
| `auth_key` | `abcJnOSJ7zs71D110EXwaS9OkuuS9bEI11` |
