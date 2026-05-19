# Deployment notes & gotchas

This is the long-form companion to the README. Read it once before going live.

## 1. Apps Script file naming

In the Apps Script editor:

| File in this repo | Type to create | Name to enter |
|---|---|---|
| `apps-script/Code.gs` | Script | `Code` |
| `apps-script/SetupSheets.gs` | Script | `SetupSheets` |
| `apps-script/Auth.gs` | Script | `Auth` |
| `apps-script/Audit.gs` | Script | `Audit` |
| `apps-script/Analytics.gs` | Script | `Analytics` |
| `apps-script/Notifications.gs` | Script | `Notifications` |
| `apps-script/Invoice.gs` | Script | `Invoice` |
| `apps-script/Index.html` | HTML | `Index` |
| `apps-script/Stylesheet.html` | HTML | `Stylesheet` |
| `apps-script/JavaScript.html` | HTML | `JavaScript` |
| `apps-script/appsscript.json` | (manifest, edit via gear icon) | `appsscript.json` |

> The `<?!= include('Stylesheet') ?>` and `<?!= include('JavaScript') ?>` lines in `Index.html` rely on those exact HTML file names.

## 2. Required OAuth scopes

The `appsscript.json` already requests:
- `spreadsheets` (read/write the sheet)
- `drive` (logo, invoice PDFs, backup ZIPs)
- `script.send_mail` (digest + order confirmations)
- `script.scriptapp` (install daily trigger)
- `script.external_request` (none currently used, future-proof)
- `userinfo.email` (Google identity)

When you first run `setupAll` or `doGet`, Google will prompt **"Authorise unsafe app"** for unverified personal scripts — that's normal for internal tools. Click *Advanced → Go to (unsafe)*.

## 3. Web App access modes

| Setting | Effect |
|---|---|
| Execute as: **Me** + Anyone in domain | Best for Google Workspace tenants. Staff log in with their domain Google account. |
| Execute as: **Me** + Anyone | Public URL — anyone with the link sees the login screen. PIN matters here. |
| Execute as: **User accessing the app** | Each user needs edit access to the sheet — usually not what you want. |

We recommend the first option. If you don't have Workspace, use the second and rotate PINs.

## 4. First-run checklist

1. `setupAll` → sheets provisioned.
2. Open `Users` sheet → set your real PIN (column D) and add staff.
3. Open `Settings` sheet OR Settings tab in the UI → fill company profile, GSTIN, address.
4. Upload your logo image to Drive → "Anyone with link can view" → copy file ID → paste in `company.logoFileId`.
5. Deploy → first login → confirm logo and KPIs render.

## 5. Existing V6 data

`Master`, `Order Book`, `Job Work Tracker`, `Dispatch Log` keep working. V7's frontend reads the *new* columns (`RatePerMtr`, `TotalValue`, `Priority`, `Transporter`, etc.) when they exist and gracefully shows `—` when blank. Backfill at your leisure.

## 6. Sheet protection

Once V7 is live, protect every sheet **except** rows ≥ 2 of these sheets:
- `Order Book`, `Job Work Tracker`, `Dispatch Log`, `Purchase Orders`, `Payments`, `Stock Ledger`, `Audit Log`.

Header row (row 1) should always be protected. `setupAll()` styles + freezes row 1; right-click it → *View more cell actions → Protect range* → restrict editors.

## 7. Performance

- `getAllIMSData()` returns the entire dataset in one round-trip. With ~5 000 rows across all sheets it stays under 2 seconds.
- Above ~20 000 rows you'll want to paginate. The cleanest place is `readSheetObjects_()` — add an optional `{ limit, offset }` argument and pass it through.

## 8. Invoice PDF tweaks

`Invoice.gs → renderInvoiceHtml_()` is just an HTML template. To change branding, edit the inline CSS at the top. The PDF is created by:

```js
Utilities.newBlob(html, "text/html").getAs("application/pdf")
```

— so anything renderable in a browser works (logos as base64, signatures, watermarks).

## 9. WhatsApp limitations

`wa.me` links open the user's installed WhatsApp client; you cannot send messages *programmatically* without the WhatsApp Business API (paid, requires Meta approval). For real automation, swap `Notifications.gs → whatsappLink()` for an HTTP POST to your provider (Gupshup, Twilio, etc.) using `UrlFetchApp.fetch`.

## 10. Disaster recovery

- Daily digest already covers operational health.
- For a real backup: Settings → Export Backup ZIP. Or open `File → Make a copy` on the sheet — preserves Apps Script too.
- The Audit Log gives you a forensic trail of *who* did *what*. Don't delete its rows; archive a copy monthly.
