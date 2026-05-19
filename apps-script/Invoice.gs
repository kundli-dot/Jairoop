// ============================================================
// Invoice.gs — generate GST tax invoices & delivery challans
// as PDFs stored in a Drive folder, with shareable links.
// ============================================================

function getOrCreateFolder_(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function generateInvoicePdf(orderId) {
  requirePerm_("invoice");
  const order = readSheetObjects_("Order Book").find(o => o.OrderID === orderId);
  if (!order) throw new Error("Order not found");
  const client = readSheetObjects_("Clients").find(c => c.ClientName === order.ClientName) || {};
  const item = readSheetObjects_("Master").find(m => m.ItemCode === order.ItemCode) || {};
  const settings = getSettings();

  const qty = parseFloat(order.OrderedQtyMtrKG) || 0;
  const rate = parseFloat(order.RatePerMtr) || parseFloat(item.SellingPricePerMtr) || 0;
  const subtotal = qty * rate;
  const gstPct = parseFloat(item.GSTPct) || parseFloat(settings["invoice.gstPct"]) || 5;
  const gstAmount = subtotal * gstPct / 100;
  const total = subtotal + gstAmount;

  const invoiceNo = (settings["invoice.prefix"] || "INV-") +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmm");

  const html = renderInvoiceHtml_({
    settings, client, item, order, qty, rate, subtotal,
    gstPct, gstAmount, total, invoiceNo
  });

  const blob = Utilities.newBlob(html, "text/html", invoiceNo + ".html").getAs("application/pdf");
  blob.setName(invoiceNo + ".pdf");
  const folder = getOrCreateFolder_("IMS Invoices");
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // patch InvoiceNo back into Dispatch Log if a dispatch exists
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dispatchSheet = ss.getSheetByName("Dispatch Log");
  const dispatchRows = dispatchSheet.getDataRange().getValues();
  const invoiceColIdx = dispatchRows[0].indexOf("InvoiceNo");
  if (invoiceColIdx >= 0) {
    for (let i = 1; i < dispatchRows.length; i++) {
      if (dispatchRows[i][1] === orderId) {
        dispatchSheet.getRange(i + 1, invoiceColIdx + 1).setValue(invoiceNo);
      }
    }
  }

  logAudit_("GENERATE_INVOICE", "Invoice", orderId, invoiceNo);
  return { ok: true, invoiceNo: invoiceNo, url: file.getUrl(), downloadUrl: "https://drive.google.com/uc?id=" + file.getId() + "&export=download" };
}

function renderInvoiceHtml_(c) {
  const accent = c.settings["theme.accent"] || "#c9a84c";
  const fmt = n => "₹" + Number(n || 0).toFixed(2);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a202c;padding:32px;font-size:12px}
    h1{font-size:22px;letter-spacing:2px;color:#0d1b2a;margin:0}
    .accent{color:${accent}}
    table{width:100%;border-collapse:collapse;margin-top:14px}
    th{background:#0d1b2a;color:white;padding:8px;text-align:left;font-size:11px;letter-spacing:1px}
    td{padding:8px;border-bottom:1px solid #e5e7eb}
    .right{text-align:right}
    .totals td{border:none;padding:4px 8px}
    .totals .grand{border-top:2px solid #0d1b2a;font-size:14px;font-weight:700}
    .hdr{display:flex;justify-content:space-between;border-bottom:3px solid ${accent};padding-bottom:14px;margin-bottom:18px}
    .meta{font-size:11px;color:#6b7280;line-height:1.6}
    .badge{display:inline-block;background:${accent};color:#1a1a1a;padding:3px 10px;border-radius:999px;font-weight:700;font-size:10px;letter-spacing:2px}
  </style></head><body>
    <div class="hdr">
      <div>
        <h1>${c.settings["company.name"]||"COMPANY"}</h1>
        <div class="accent" style="font-size:10px;letter-spacing:3px;margin-top:4px">${c.settings["company.tagline"]||""}</div>
        <div class="meta" style="margin-top:10px">${c.settings["company.address"]||""}<br>
          GSTIN: ${c.settings["company.gstin"]||"—"} | Phone: ${c.settings["company.phone"]||"—"}<br>
          Email: ${c.settings["company.email"]||"—"}</div>
      </div>
      <div style="text-align:right">
        <div class="badge">TAX INVOICE</div>
        <div style="margin-top:10px;font-size:14px;font-weight:700">${c.invoiceNo}</div>
        <div class="meta">Date: ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd MMM yyyy")}</div>
        <div class="meta">Order Ref: ${c.order.OrderID}</div>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;gap:30px">
      <div style="flex:1">
        <div style="font-size:10px;color:#6b7280;letter-spacing:2px;font-weight:700">BILL TO</div>
        <div style="font-weight:700;font-size:13px;margin-top:4px">${c.client.ClientName||c.order.ClientName||"—"}</div>
        <div class="meta">${c.client.BillingAddress||"—"}<br>
          GSTIN: ${c.client.GSTIN||"—"}<br>
          Phone: ${c.client.Phone||"—"}</div>
      </div>
      <div style="flex:1">
        <div style="font-size:10px;color:#6b7280;letter-spacing:2px;font-weight:700">SHIP TO</div>
        <div style="font-weight:700;font-size:13px;margin-top:4px">${c.client.ClientName||c.order.ClientName||"—"}</div>
        <div class="meta">${c.client.ShippingAddress||c.client.BillingAddress||"—"}</div>
      </div>
    </div>

    <table>
      <thead><tr>
        <th>#</th><th>Item</th><th>HSN</th><th class="right">Qty (Mtr)</th>
        <th class="right">Rate</th><th class="right">Amount</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>1</td>
          <td><b>${c.item.ItemName||c.order.ItemCode}</b><br><span class="meta">${c.order.ItemCode}</span></td>
          <td>${c.item.HSNCode||"—"}</td>
          <td class="right">${c.qty.toFixed(2)}</td>
          <td class="right">${fmt(c.rate)}</td>
          <td class="right">${fmt(c.subtotal)}</td>
        </tr>
      </tbody>
    </table>

    <table class="totals" style="width:340px;float:right;margin-top:16px">
      <tr><td>Subtotal</td><td class="right">${fmt(c.subtotal)}</td></tr>
      <tr><td>GST @ ${c.gstPct}%</td><td class="right">${fmt(c.gstAmount)}</td></tr>
      <tr class="grand"><td>Total</td><td class="right">${fmt(c.total)}</td></tr>
      <tr><td>Advance Received</td><td class="right">${fmt(c.order.AdvanceReceived)}</td></tr>
      <tr class="grand"><td>Balance Due</td><td class="right">${fmt(c.total - (parseFloat(c.order.AdvanceReceived)||0))}</td></tr>
    </table>

    <div style="clear:both;margin-top:60px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:10px;color:#6b7280">
      This is a computer-generated invoice. E.&amp;O.E.<br>
      For ${c.settings["company.name"]||"COMPANY"} — Authorised Signatory
    </div>
  </body></html>`;
}

function generateChallanPdf(dispatchId) {
  requirePerm_("invoice");
  const dispatch = readSheetObjects_("Dispatch Log").find(d => d.DispatchID === dispatchId);
  if (!dispatch) throw new Error("Dispatch not found");
  const settings = getSettings();
  const client = readSheetObjects_("Clients").find(c => c.ClientName === dispatch.ClientName) || {};
  const accent = settings["theme.accent"] || "#c9a84c";

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;padding:32px;font-size:12px}
    h1{margin:0;color:#0d1b2a}
    .hdr{border-bottom:3px solid ${accent};padding-bottom:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{padding:8px;border:1px solid #e5e7eb;text-align:left}
    th{background:#0d1b2a;color:white}
    .badge{display:inline-block;background:${accent};padding:3px 10px;border-radius:999px;font-weight:700;font-size:10px;letter-spacing:2px}
  </style></head><body>
    <div class="hdr"><h1>${settings["company.name"]}</h1><div class="badge">DELIVERY CHALLAN</div></div>
    <p><b>Challan #</b> ${dispatch.ChallanNo||dispatch.DispatchID}<br>
    <b>Date:</b> ${dispatch.DispatchDate}<br>
    <b>Vehicle:</b> ${dispatch.VehicleNo||"—"} | <b>LR No:</b> ${dispatch.LRNumber||"—"}<br>
    <b>Transporter:</b> ${dispatch.Transporter||"—"}</p>
    <p><b>Client:</b> ${dispatch.ClientName}<br>
    <b>Ship To:</b> ${client.ShippingAddress||"—"}</p>
    <table><thead><tr><th>Item Code</th><th>Description</th><th>Qty (Mtr)</th></tr></thead>
    <tbody><tr><td>${dispatch.ItemCode}</td><td>${(readSheetObjects_("Master").find(m=>m.ItemCode===dispatch.ItemCode)||{}).ItemName||"—"}</td><td>${dispatch.DispatchedQty}</td></tr></tbody></table>
    <p style="margin-top:60px;border-top:1px solid #e5e7eb;padding-top:12px;font-size:10px;color:#666">Received in good condition — Signature: ____________________</p>
  </body></html>`;

  const blob = Utilities.newBlob(html, "text/html", dispatchId + ".html").getAs("application/pdf");
  blob.setName("CHALLAN-" + dispatchId + ".pdf");
  const file = getOrCreateFolder_("IMS Challans").createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  logAudit_("GENERATE_CHALLAN", "Invoice", dispatchId, file.getName());
  return { ok: true, url: file.getUrl() };
}
