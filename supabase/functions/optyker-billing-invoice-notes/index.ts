import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const U = Deno.env.get("SUPABASE_URL") || "";
const S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(U, S, { auth: { autoRefreshToken: false, persistSession: false } });
const ADMIN_USER = "OTTICA VISUAL CARE";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
    ["verify"]
  );
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
function invoiceId(v: unknown) {
  const id = String(v || "").trim();
  if (!UUID.test(id)) throw new Error("Fattura non valida");
  return id;
}
async function assertInvoice(id: string) {
  const { data, error } = await db.from("optyker_billing_invoices").select("id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Fattura non trovata");
}
async function listNotes(id: string) {
  await assertInvoice(id);
  const { data, error } = await db.from("optyker_billing_invoice_annotations")
    .select("id,invoice_id,kind,body,created_by,created_at")
    .eq("invoice_id", id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function addNote(id: string, kindRaw: unknown, bodyRaw: unknown) {
  await assertInvoice(id);
  const kind = String(kindRaw || "note").trim().toLowerCase() === "line" ? "line" : "note";
  const body = String(bodyRaw || "").replace(/\r\n/g, "\n").trim();
  if (!body) throw new Error("Scrivi la riga o la nota da aggiungere");
  if (body.length > 2000) throw new Error("La nota può contenere al massimo 2000 caratteri");
  const { data, error } = await db.from("optyker_billing_invoice_annotations")
    .insert({ invoice_id: id, kind, body, created_by: "Ottica Visual Care" })
    .select("id,invoice_id,kind,body,created_by,created_at")
    .single();
  if (error) throw error;
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return out(req, { ok:false, error:"METHOD_NOT_ALLOWED" }, 405);
  try {
    const session = await verifyToken(req);
    if (!session) return out(req, { ok:false, error:"Sessione amministrativa non valida o scaduta" }, 401);
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "").trim();
    const id = invoiceId(b.invoice_id);
    if (action === "list") return out(req, { ok:true, data: await listNotes(id) });
    if (action === "add") return out(req, { ok:true, data: await addNote(id, b.kind, b.body) });
    return out(req, { ok:false, error:"Azione non riconosciuta" }, 400);
  } catch (e) {
    return out(req, { ok:false, error:e instanceof Error ? e.message : String(e) }, 500);
  }
});
