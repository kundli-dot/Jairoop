# Deployment Guide — Jai Roop Textiles IMS V7

## Step 1: Prepare your Google Sheet

1. Open your spreadsheet:  
   https://docs.google.com/spreadsheets/d/19DMKtsGlL2GvDAZSW7tfJ8S-8Vi_vk0dka_IG-hIbWw/edit

2. Confirm these tabs exist (names must match exactly):
   - `Master`
   - `Order Book`
   - `Job Work Tracker`
   - `Dispatch Log`

3. `Stock Movements` is optional — the script creates it automatically when you record the first movement.

## Step 2: Install Apps Script

1. In the spreadsheet: **Extensions → Apps Script**
2. Delete any default `Code.gs` content
3. Copy all of `google-apps-script/Code.gs` from this repo → paste into `Code.gs`
4. Click **+** next to Files → **HTML** → name it exactly `Index` (not Index.html)
5. Copy all of `google-apps-script/Index.html` → paste into the `Index` file
6. Save (Ctrl+S)

## Step 3: Set timezone

1. In Apps Script: **Project Settings** (gear icon)
2. Set **Time zone** to `(GMT+05:30) India Standard Time`

## Step 4: Deploy as web app

1. Click **Deploy → New deployment**
2. Type: **Web app**
3. Settings:
   - **Execute as**: Me
   - **Who has access**: Anyone (or Anyone with Google account — your choice)
4. Click **Deploy** → authorize when prompted
5. Copy the **Web app URL** — this is your IMS dashboard link

## Step 5: Enable auto-allocation sync (recommended)

1. In Apps Script left panel: **Triggers** (clock icon)
2. **Add trigger**:
   - Function: `onEdit`
   - Event: From spreadsheet → On edit
3. Save

This keeps Master “Allocated” column in sync when order status changes.

## Step 6: Optional — daily reorder email

1. **Triggers → Add trigger**
2. Function: `sendDailyReorderEmail`
3. Event: Time-driven → Day timer → 8am–9am
4. You will receive an email when items are at `REORDER (LOW)`

## Step 7: Logo (optional)

The dashboard loads your logo from Google Drive file ID in `CONFIG.logoFileId` inside `Code.gs`.  
To use your own logo:
1. Upload logo to Google Drive
2. Copy file ID from URL: `https://drive.google.com/file/d/FILE_ID_HERE/view`
3. Update `logoFileId` in `Code.gs`

## Mobile access

Bookmark the web app URL on phones. The UI is responsive and works in Chrome/Safari.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank dashboard | Re-deploy web app; check browser console |
| “Sync failed” | Re-authorize script; confirm sheet tab names |
| Allocated qty not updating | Add `onEdit` trigger (Step 5) |
| Logo missing | Update `logoFileId` or ignore — text fallback shows |

## Updating to a new version

1. Replace `Code.gs` and `Index` HTML with new files from repo
2. **Deploy → Manage deployments → Edit → New version → Deploy**

Do not create a new deployment unless you want a new URL.
