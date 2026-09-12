import {createSiteHandler} from './handler.mjs';
Deno.serve(createSiteHandler({url:Deno.env.get('SUPABASE_URL')||'',serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''}));
