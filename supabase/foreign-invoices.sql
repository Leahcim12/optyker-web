BEGIN;
CREATE TABLE IF NOT EXISTS public.optyker_foreign_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_sha text NOT NULL UNIQUE,
 filename text NOT NULL, mime text NOT NULL, size integer NOT NULL CHECK(size>0 AND size<=8388608),
 storage_path text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'uploaded'
 CHECK(status IN ('uploaded','extracting','extracted','extract_error')),
 extraction jsonb, extraction_error text, lease_until timestamptz NOT NULL DEFAULT '1970-01-01',
 invoice_key text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.optyker_foreign_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.optyker_foreign_sources FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.optyker_foreign_sources TO service_role;
ALTER TABLE public.optyker_fic_drafts ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.optyker_foreign_sources(id);
ALTER TABLE public.optyker_fic_drafts ADD COLUMN IF NOT EXISTS source_context jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS optyker_fic_drafts_one_source ON public.optyker_fic_drafts(source_id) WHERE source_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.optyker_fic_save_import_preview(p_row jsonb,p_invoice_key text)
RETURNS public.optyker_fic_drafts LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE saved public.optyker_fic_drafts;
BEGIN
 IF p_row->>'series'<>'foreign' OR p_row->>'state'<>'preview' OR p_row->>'source_id' IS NULL THEN
  RAISE EXCEPTION 'Integrazione non valida';
 END IF;
 PERFORM 1 FROM public.optyker_foreign_sources WHERE id=(p_row->>'source_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Originale non trovato'; END IF;
 UPDATE public.optyker_foreign_sources SET invoice_key=p_invoice_key,updated_at=now() WHERE id=(p_row->>'source_id')::uuid;
 INSERT INTO public.optyker_fic_drafts(id,number,series,year,payload,totals,state,source_id,source_context)
 VALUES((p_row->>'id')::uuid,(p_row->>'number')::integer,'foreign',(p_row->>'year')::integer,p_row->'payload',p_row->'totals','preview',(p_row->>'source_id')::uuid,p_row->'source_context')
 ON CONFLICT(id) DO UPDATE SET payload=EXCLUDED.payload,totals=EXCLUDED.totals,state='preview',source_context=EXCLUDED.source_context,
  review_hash=NULL,reviewed_at=NULL,last_error=NULL,updated_at=now()
 WHERE optyker_fic_drafts.state IN ('preview','create_rejected') AND optyker_fic_drafts.source_id=EXCLUDED.source_id
  AND optyker_fic_drafts.series='foreign' AND optyker_fic_drafts.year=EXCLUDED.year
 RETURNING * INTO saved;
 IF saved.id IS NULL THEN RAISE EXCEPTION 'Documento già creato o originale differente'; END IF;
 RETURN saved;
END $$;
REVOKE EXECUTE ON FUNCTION public.optyker_fic_save_import_preview(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.optyker_fic_save_import_preview(jsonb,text) TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('optyker-foreign-invoices','optyker-foreign-invoices',false,8388608,ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=8388608,allowed_mime_types=EXCLUDED.allowed_mime_types;
COMMIT;
