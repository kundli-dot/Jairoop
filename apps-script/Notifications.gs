// ============================================================
// Notifications.gs — email digest, WhatsApp deep-links,
// reorder alerts. Install daily trigger via installDailyDigest().
// ============================================================

function installDailyDigest() {
  requirePerm_("settings");
  // remove existing
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "sendDailyDigest") ScriptApp.deleteTrigger(t);
  });
  const settings = getSettings();
  const hour = parseInt(settings["alert.digestHour"], 10) || 9;
  ScriptApp.newTrigger("sendDailyDigest").timeBased().everyDays(1).atHour(hour).create();
  logAudit_("INSTALL_TRIGGER", "Notifications", "dailyDigest", "hour=" + hour);
  return { ok: true, message: "Daily digest scheduled at " + hour + ":00 IST." };
}

function sendDailyDigest() {
  const settings = getSettings();
  const to = settings["alert.recipientEmail"];
  if (!to) return;
  const k = computeKPIs(
    readSheetObjects_("Master"),
    readSheetObjects_("Order Book"),
    readSheetObjects_("Job Work Tracker"),
    readSheetObjects_("Dispatch Log")
  );
  const reorderRows = reorderRecommendations().filter(r => r.action === "REORDER");
  const receivables = clientReceivables().slice(0, 5);

  const html = renderDigestHtml_(settings, k, reorderRows, receivables);
  MailApp.sendEmail({
    to: to,
    subject: "[" + (settings["company.name"] || "IMS") + "] Daily digest — " +
             Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd MMM yyyy"),
    htmlBody: html
  });
  logAudit_("SEND_DIGEST", "Notifications", "", to);
}

function renderDigestHtml_(settings, k, reorder, receivables) {
  const accent = settings["theme.accent"] || "#c9a84c";
  const rows = reorder.map(r =>
    `<tr><td>${r.code}</td><td>${r.balance}</td><td>${r.reorderPoint}</td><td><b>${r.suggestedOrder}</b></td></tr>`
  ).join("") || `<tr><td colspan="4" style="text-align:center;color:#888">No reorders needed.</td></tr>`;
  const recRows = receivables.map(r =>
    `<tr><td>${r.client}</td><td>₹${r.billed.toFixed(2)}</td><td>₹${r.received.toFixed(2)}</td><td><b>₹${r.balance.toFixed(2)}</b></td></tr>`
  ).join("") || `<tr><td colspan="4" style="text-align:center;color:#888">No outstanding receivables.</td></tr>`;

  return `
  <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto">
    <div style="background:#0d1b2a;color:white;padding:16px 20px;border-radius:8px 8px 0 0">
      <div style="font-size:18px;font-weight:700;letter-spacing:2px">${settings["company.name"]}</div>
      <div style="color:${accent};font-size:11px;letter-spacing:3px">DAILY OPERATIONS DIGEST</div>
    </div>
    <div style="background:white;padding:20px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
      <table style="width:100%;border-collapse:separate;border-spacing:8px;text-align:center">
        <tr>
          <td style="background:#fee2e2;padding:12px;border-radius:6px"><div style="font-size:11px;color:#991b1b;font-weight:700">REORDERS</div><div style="font-size:22px;font-weight:800;color:#dc2626">${k.reorderCount}</div></td>
          <td style="background:#dbeafe;padding:12px;border-radius:6px"><div style="font-size:11px;color:#1e40af;font-weight:700">ACTIVE</div><div style="font-size:22px;font-weight:800;color:#2563eb">${k.activeOrderCount}</div></td>
          <td style="background:#fef3c7;padding:12px;border-radius:6px"><div style="font-size:11px;color:#92400e;font-weight:700">JW LIVE</div><div style="font-size:22px;font-weight:800;color:#d97706">${k.jwLiveCount}</div></td>
          <td style="background:#d1fae5;padding:12px;border-radius:6px"><div style="font-size:11px;color:#065f46;font-weight:700">DISPATCHED</div><div style="font-size:22px;font-weight:800;color:#059669">${(k.totalDispatched||0).toLocaleString()}</div></td>
        </tr>
      </table>
      <h3 style="color:#0d1b2a;border-bottom:2px solid ${accent};padding-bottom:6px;margin-top:24px">Items to Reorder</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#0d1b2a;color:white"><th style="padding:8px">Item</th><th>Balance</th><th>ROP</th><th>Suggest Order</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <h3 style="color:#0d1b2a;border-bottom:2px solid ${accent};padding-bottom:6px;margin-top:24px">Top 5 Outstanding Receivables</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#0d1b2a;color:white"><th style="padding:8px">Client</th><th>Billed</th><th>Received</th><th>Balance Due</th></tr></thead>
        <tbody>${recRows}</tbody>
      </table>
      <p style="margin-top:24px;font-size:11px;color:#888">Sent automatically by Jai Roop Textiles IMS V7.</p>
    </div>
  </div>`;
}

// WhatsApp deep-link generator — no auth needed, pure URL.
function whatsappLink(phone, message) {
  const settings = getSettings();
  const cc = String(settings["whatsapp.countryCode"] || "91");
  let p = String(phone || "").replace(/[^0-9]/g, "");
  if (p.length === 10) p = cc + p;
  return "https://wa.me/" + p + "?text=" + encodeURIComponent(message || "");
}

function sendOrderConfirmation(orderId) {
  requirePerm_("write");
  const order = readSheetObjects_("Order Book").find(o => o.OrderID === orderId);
  const client = readSheetObjects_("Clients").find(c => c.ClientName === order.ClientName);
  if (!order) throw new Error("Order not found");
  if (!client || !client.Email) throw new Error("Client email missing");
  const settings = getSettings();
  MailApp.sendEmail({
    to: client.Email,
    subject: "Order Confirmation — " + orderId,
    htmlBody: `<p>Dear ${client.ContactPerson || client.ClientName},</p>
      <p>We have received your order <b>${orderId}</b> for <b>${order.OrderedQtyMtrKG} Mtr</b> of <b>${order.ItemCode}</b>.</p>
      <p>Expected delivery: <b>${order.ExpectedDelivery || "to be confirmed"}</b></p>
      <p>Total value: <b>₹${(parseFloat(order.TotalValue)||0).toFixed(2)}</b></p>
      <p>Thank you for your business.<br>${settings["company.name"]}</p>`
  });
  logAudit_("SEND_CONFIRMATION", "Notifications", orderId, client.Email);
  return { ok: true, message: "Confirmation sent to " + client.Email };
}
