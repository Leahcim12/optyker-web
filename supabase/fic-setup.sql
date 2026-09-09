BEGIN;
CREATE TABLE IF NOT EXISTS public.optyker_fic_states (
 state_hash text PRIMARY KEY,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public.optyker_fic_connection (
 id smallint PRIMARY KEY CHECK (id=1),
 company_id text NOT NULL,
 tokens text NOT NULL,
 connected_at timestamptz NOT NULL,
 lease uuid,
 lease_until timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z'
);
ALTER TABLE public.optyker_fic_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.optyker_fic_connection ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.optyker_fic_states,public.optyker_fic_connection FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.optyker_fic_states,public.optyker_fic_connection TO service_role;
COMMIT;
