import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// SECURITY CONTAINMENT 20260911: both legacy reset and registration could
// overwrite existing passwords from public biographical data. Keep them closed.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ ok: false, error: "Metodo non consentito" }), { status: 405, headers });
  return new Response(JSON.stringify({
    ok: false, code: "EMAIL_VERIFICATION_REQUIRED",
    error: "Per proteggere il tuo account, il recupero diretto è stato disabilitato. Aggiorna l’app e richiedi il link di recupero inviato alla tua email. Non è possibile cambiare password usando i dati anagrafici.",
    version: "20260911-auth-containment-v1",
  }), { status: 403, headers });
});
