CREATE TABLE IF NOT EXISTS public.ai_gif_requests (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_path text NOT NULL,
  prompt text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING_AI',
  moderation_status text NOT NULL DEFAULT 'PENDING',
  output_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_gif_status_chk CHECK (status IN ('PENDING_AI','PROCESSING','READY','FAILED')),
  CONSTRAINT ai_gif_moderation_chk CHECK (moderation_status IN ('PENDING','APPROVED','HIDDEN','REJECTED'))
);

ALTER TABLE public.ai_gif_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_gif_select_own ON public.ai_gif_requests;
CREATE POLICY ai_gif_select_own ON public.ai_gif_requests FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS ai_gif_insert_own ON public.ai_gif_requests;
CREATE POLICY ai_gif_insert_own ON public.ai_gif_requests FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS ai_gif_delete_own ON public.ai_gif_requests;
CREATE POLICY ai_gif_delete_own ON public.ai_gif_requests FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-gif-source', 'ai-gif-source', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS ai_gif_source_upload_own ON storage.objects;
CREATE POLICY ai_gif_source_upload_own ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='ai-gif-source' AND (storage.foldername(name))[1]=(select auth.uid())::text);

DROP POLICY IF EXISTS ai_gif_source_read_own ON storage.objects;
CREATE POLICY ai_gif_source_read_own ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='ai-gif-source' AND (storage.foldername(name))[1]=(select auth.uid())::text);

DROP POLICY IF EXISTS ai_gif_source_delete_own ON storage.objects;
CREATE POLICY ai_gif_source_delete_own ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='ai-gif-source' AND (storage.foldername(name))[1]=(select auth.uid())::text);
