import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Compatibility entrypoint for the physical POS channel.
// The physical checkout itself remains in optyker-cash-local-api: only its
// server-side quote_lines request is routed through POS v2, which knows how to
// resolve persistent Laboratory/Busta ids such as client_cart:<uuid> without
// ever sending them to Shopify's nodes(ids:[ID!]!) query.
const U=(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"");
const LEGACY=U+"/functions/v1/optyker-cash-register-api";
const POS_V2=U+"/functions/v1/optyker-cash-register-api-v2";
const nativeFetch=globalThis.fetch.bind(globalThis);

function requestUrl(input:RequestInfo|URL):string{
  if(typeof input==="string")return input;
  if(input instanceof URL)return input.toString();
  return input.url;
}
function bodyText(body:BodyInit|null|undefined):string{
  if(typeof body==="string")return body;
  if(body instanceof Uint8Array)return new TextDecoder().decode(body);
  return "";
}

(globalThis as any).fetch=(input:RequestInfo|URL,init?:RequestInit)=>{
  if(requestUrl(input)===LEGACY&&String(init?.method||"GET").toUpperCase()==="POST"){
    try{
      const parsed=JSON.parse(bodyText(init?.body));
      if(parsed?.action==="quote_lines"){
        return nativeFetch(POS_V2,init);
      }
    }catch{
      // Preserve the original request if it is not a JSON API call.
    }
  }
  return nativeFetch(input,init);
};

// Pin the already-proven physical POS implementation. This wrapper changes only
// quote routing; sale creation, inventory movements, invoices and RCH snapshots
// stay in the physical/local channel.
await import("https://raw.githubusercontent.com/Leahcim12/optyker-web/c5c145075cc1bc61a70b37eea8c02887ca301d41/supabase/functions/optyker-cash-local-api/index.ts");
