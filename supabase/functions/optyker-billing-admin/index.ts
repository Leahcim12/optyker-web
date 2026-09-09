import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { connectionStatus, startConnection, finishConnection, syncFic } from './fic.ts';
import { issuance } from './issuance.ts';
import { foreignAction } from './foreign.ts';

const U = Deno.env.get("SUPABASE_URL") || "";
const S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(U, S, { auth: { autoRefreshToken: false, persistSession: false } });
const ADMIN_USER = "OTTICA VISUAL CARE";

const ALLOWED = new Set([
  "https://optyker.it",
  "https://www.optyker.it",
  "https://optyker-web.vercel.app",
  "https://leahcim12.github.io"
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allow = ALLOWED.has(origin) ? origin : (origin ? "https://www.optyker.it" : "*");
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Cache-Control": "no-store"
  };
}
function out(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" }
  });
}
function normUser(v: unknown) {
  return String(v || "").trim().replace(/\s+/g, " ").toUpperCase();
}
async function rpc(name: string, body: Record<string, unknown>) {
  const { data, error } = await db.rpc(name, body);
  if (error) throw error;
  return data;
}
function b64u(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64uText(s: string) {
  return b64u(new TextEncoder().encode(s));
}
function b64uDecodeText(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const raw = atob(s);
  return new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0)));
}
async function signingKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(S),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
async function issueToken(username: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64uText(JSON.stringify({
    sub: username,
    scope: "billing_admin",
    iat: now,
    exp: now + 8 * 60 * 60
  }));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(payload)));
  return payload + "." + b64u(sig);
}
async function verifyToken(req: Request) {
  const h = req.headers.get("authorization") || "";
  const token = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
  const [payload, sigText] = token.split(".");
  if (!payload || !sigText) return null;
  try {
    let s = sigText.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const raw = atob(s);
    const sig = Uint8Array.from(raw, c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify("HMAC", await signingKey(), sig, new TextEncoder().encode(payload));
    if (!ok) return null;
    const p = JSON.parse(b64uDecodeText(payload));
    if (p.scope !== "billing_admin" || normUser(p.sub) !== ADMIN_USER || Number(p.exp || 0) < Date.now() / 1000) return null;
    return p;
  } catch {
    return null;
  }
}
function clampLimit(v: unknown) {
  const n = Number(v || 250);
  return Math.max(1, Math.min(500, Number.isFinite(n) ? Math.floor(n) : 250));
}
function dateBounds(b: any) {
  let from = String(b.date_from || "").trim();
  let to = String(b.date_to || "").trim();
  const y = Number(b.year || 0), m = Number(b.month || 0), d = Number(b.day || 0);
  if (!from && !to && y >= 2000 && y <= 2100) {
    const mm = m >= 1 && m <= 12 ? m : 1;
    const dd = d >= 1 && d <= 31 ? d : 1;
    const start = new Date(Date.UTC(y, mm - 1, dd));
    let end: Date;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) end = new Date(Date.UTC(y, mm - 1, dd + 1));
    else if (m >= 1 && m <= 12) end = new Date(Date.UTC(y, mm, 1));
    else end = new Date(Date.UTC(y + 1, 0, 1));
    from = start.toISOString().slice(0,10);
    const e = new Date(end.getTime() - 86400000);
    to = e.toISOString().slice(0,10);
  }
  return { from, to };
}
async function listInvoices(b: any, errorsOnly = false) {
  const fields = "id,provider_invoice_id,direction,invoice_number,issue_date,received_at,counterparty_name,counterparty_vat,counterparty_fiscal_code,header,supplier_type,total,currency,sdi_status,sdi_error_code,sdi_error_message,sdi_protocol,provider_status,created_at,updated_at";
  let q = db.from("optyker_billing_invoices").select(fields);
  if (!errorsOnly) {
    const dir = String(b.direction || "");
    if (dir === "incoming" || dir === "outgoing") q = q.eq("direction", dir);
  } else {
    q = q.or("sdi_error_code.not.is.null,sdi_status.in.(error,rejected,scartata,scarto)");
  }
  const bounds = dateBounds(b);
  if (bounds.from) q = q.gte("issue_date", bounds.from);
  if (bounds.to) q = q.lte("issue_date", bounds.to);
  const cp = String(b.counterparty || "").trim();
  if (cp) q = q.ilike("counterparty_name", "%" + cp.replace(/[%_]/g, "") + "%");
  const st = String(b.supplier_type || "").trim();
  if (st) q = q.eq("supplier_type", st);
  const status = String(b.sdi_status || "").trim();
  if (status) q = q.eq("sdi_status", status);
  const search = String(b.q || "").trim().replace(/[,%()]/g, " ");
  if (search) {
    const safe = search.replace(/[%_]/g, "").slice(0,120);
    q = q.or("invoice_number.ilike.%" + safe + "%,header.ilike.%" + safe + "%,counterparty_name.ilike.%" + safe + "%,counterparty_vat.ilike.%" + safe + "%,sdi_error_code.ilike.%" + safe + "%");
  }
  q = q.order("issue_date", { ascending: false, nullsFirst: false }).order("received_at", { ascending: false, nullsFirst: false }).limit(clampLimit(b.limit));
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
async function providerStatus() {
  const { data, error } = await db.from("optyker_billing_provider_config")
    .select("provider_name,sdi_code,enabled,last_sync_at,last_sync_error,updated_at")
    .eq("id", 1).maybeSingle();
  if (error) throw error;
  return data || { provider_name:"", sdi_code:"", enabled:false, last_sync_at:null, last_sync_error:null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method === 'GET') {
    try {
      await finishConnection(db,req);
      return new Response(null,{status:303,headers:{Location:'https://optyker.it/?fic=connected','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    } catch {
      return new Response('Collegamento non completato. Torna in Optyker e ripeti l’autorizzazione.',{status:400,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    }
  }
  if (req.method !== "POST") return out(req, { ok:false, error:"METHOD_NOT_ALLOWED" }, 405);
  try {
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "");

    if (action === "auth_status") {
      const x = await rpc("optyker_staff_auth_status_internal", { p_username: "Ottica Visual Care" });
      return out(req, x, x?.ok === false ? 400 : 200);
    }
    if (action === "set_initial_password") {
      const password = String(b.password || "");
      const confirm = String(b.confirm_password || "");
      if (password !== confirm) return out(req, { ok:false, error:"Le password non coincidono" }, 400);
      const x = await rpc("optyker_staff_set_initial_password_internal", {
        p_username: "Ottica Visual Care",
        p_email: "",
        p_password: password
      });
      if (x?.ok === false) return out(req, x, 400);
      const logged = await rpc("optyker_staff_login_internal", { p_username:"Ottica Visual Care", p_password:password });
      if (logged?.ok === false) return out(req, { ok:false, error:"Impossibile completare l'accesso" }, 401);
      return out(req, { ok:true, username:"Ottica Visual Care", token: await issueToken("Ottica Visual Care"), expires_in:28800 });
    }
    if (action === "login") {
      const username = normUser(b.username || "Ottica Visual Care");
      const password = String(b.password || "");
      if (username !== ADMIN_USER) return out(req, { ok:false, error:"Utente non autorizzato" }, 401);
      if (password.length < 8) return out(req, { ok:false, error:"Password non valida" }, 400);
      const x = await rpc("optyker_staff_login_internal", { p_username:"Ottica Visual Care", p_password:password });
      if (x?.ok === false) return out(req, { ok:false, error:x.error || "Password errata", needs_password:!!x.needs_password }, 401);
      return out(req, { ok:true, username:"Ottica Visual Care", token: await issueToken("Ottica Visual Care"), expires_in:28800 });
    }

    const session = await verifyToken(req);
    if (!session) return out(req, { ok:false, error:"Sessione amministrativa non valida o scaduta" }, 401);

    if (['foreign_status','foreign_upload','foreign_list','foreign_get','foreign_original','foreign_extract'].includes(action)) return out(req,{ok:true,...await foreignAction(db,action,b)});

    if (['fic_form','fic_preview','fic_draft','fic_drafts','fic_create','fic_document','fic_send'].includes(action)) return out(req,{ok:true,...await issuance(db,action,b)});
    if (action === 'fic_status') return out(req,{ok:true,data:await connectionStatus(db)});
    if (action === 'fic_connect') return out(req,{ok:true,url:await startConnection(db,b.write===true)});

    if (action === "provider_status") {
      return out(req, { ok:true, data: await providerStatus() });
    }
    if (action === "list") {
      const data = await listInvoices(b, false);
      return out(req, { ok:true, data });
    }
    if (action === "errors") {
      const data = await listInvoices(b, true);
      return out(req, { ok:true, data });
    }
    if (action === "counterparties") {
      let q = db.from("optyker_billing_invoices").select("counterparty_name,supplier_type").neq("counterparty_name","");
      const dir = String(b.direction || "");
      if (dir === "incoming" || dir === "outgoing") q = q.eq("direction",dir);
      const { data, error } = await q.order("counterparty_name").limit(1000);
      if (error) throw error;
      const seen = new Map<string,string>();
      for (const row of data || []) if (!seen.has(row.counterparty_name)) seen.set(row.counterparty_name, row.supplier_type || "");
      return out(req, { ok:true, data:Array.from(seen, ([name,supplier_type]) => ({name,supplier_type})) });
    }
    if (action === "sync") {
      const fic = await connectionStatus(db);
      if (fic.connected) return out(req,{ok:true,...await syncFic(db)});
      const cfg:any = await providerStatus();
      if (!cfg.enabled || !cfg.provider_name) {
        return out(req, {
          ok:false,
          error:"Collegamento al sistema di fatturazione elettronica non ancora configurato",
          code:"PROVIDER_NOT_CONFIGURED"
        }, 409);
      }
      return out(req, {
        ok:false,
        error:"Il connettore del provider è configurato ma l'adattatore API deve essere completato",
        code:"PROVIDER_ADAPTER_PENDING"
      }, 501);
    }
    return out(req, { ok:false, error:"Azione non riconosciuta" }, 400);
  } catch (e) {
    return out(req, { ok:false, error:e instanceof Error ? e.message : String(e) }, 500);
  }
});
