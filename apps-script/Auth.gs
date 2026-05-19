// ============================================================
// Auth.gs — lightweight PIN-based role gate
// Google identity is the primary key (web app must be
// "Execute as: Me / Access: Anyone in domain" or "Anyone").
// PIN is a second factor stored in the Users sheet.
// Roles: ADMIN | MANAGER | STAFF | VIEWER
// ============================================================

const ROLE_PERMS = {
  ADMIN:   { read: true, write: true, delete: true, settings: true, payments: true, invoice: true },
  MANAGER: { read: true, write: true, delete: false, settings: false, payments: true, invoice: true },
  STAFF:   { read: true, write: true, delete: false, settings: false, payments: false, invoice: false },
  VIEWER:  { read: true, write: false, delete: false, settings: false, payments: false, invoice: false }
};

function getCurrentUserContext() {
  const email = (Session.getActiveUser().getEmail() || "").toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  let role = "VIEWER";
  let name = email || "Guest";
  let active = false;

  if (sheet && sheet.getLastRow() > 1) {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).toLowerCase() === email) {
        name = rows[i][1] || email;
        role = rows[i][2] || "VIEWER";
        active = String(rows[i][4]).toLowerCase() === "yes";
        sheet.getRange(i + 1, 6).setValue(new Date());
        break;
      }
    }
  }

  return {
    email: email,
    name: name,
    role: active ? role : "VIEWER",
    active: active,
    perms: ROLE_PERMS[active ? role : "VIEWER"] || ROLE_PERMS.VIEWER
  };
}

function verifyPin(pin) {
  const ctx = getCurrentUserContext();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  if (!sheet) return { ok: false, message: "User table missing — run setupAll()." };
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === ctx.email) {
      if (String(rows[i][3]) === String(pin)) {
        return { ok: true, user: ctx };
      }
      return { ok: false, message: "Incorrect PIN." };
    }
  }
  return { ok: false, message: "Your Google account (" + ctx.email + ") is not registered. Ask an admin to add you to the Users sheet." };
}

function requirePerm_(perm) {
  const ctx = getCurrentUserContext();
  if (!ctx.perms[perm]) {
    throw new Error("Permission denied (" + perm + ") for role " + ctx.role);
  }
  return ctx;
}

function listUsers() {
  requirePerm_("settings");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = ss.getSheetByName("Users").getDataRange().getValues();
  const headers = rows.shift();
  return rows.filter(r => r[0]).map(r => {
    const o = {}; headers.forEach((h, i) => o[h] = r[i]); return o;
  });
}

function upsertUser(payload) {
  requirePerm_("settings");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === String(payload.email).toLowerCase()) {
      sheet.getRange(i + 1, 1, 1, 7).setValues([[
        payload.email, payload.name, payload.role, payload.pin, payload.active || "Yes",
        rows[i][5], payload.notes || ""
      ]]);
      logAudit_("UPDATE_USER", "Users", payload.email, payload.role);
      return { ok: true, message: "User updated." };
    }
  }
  sheet.appendRow([payload.email, payload.name, payload.role, payload.pin, payload.active || "Yes", "", payload.notes || ""]);
  logAudit_("ADD_USER", "Users", payload.email, payload.role);
  return { ok: true, message: "User added." };
}
