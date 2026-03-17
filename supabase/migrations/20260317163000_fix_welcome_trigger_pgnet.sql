-- Fix: Make welcome trigger tolerant to missing pg_net extension
-- If 'net' schema doesn't exist, skip the HTTP call silently

CREATE OR REPLACE FUNCTION public.trigger_welcome_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_platform_url TEXT;
  v_anon_key TEXT;
BEGIN
  -- Grab settings
  SELECT platform_url, supabase_anon_key
  INTO v_platform_url, v_anon_key
  FROM public.app_settings
  WHERE id = 1
  LIMIT 1;

  -- Only call if pg_net extension is available (schema 'net' exists)
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
    PERFORM
      net.http_post(
        url     := v_platform_url || '/functions/v1/platform-welcome-notification',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_anon_key, '')
        ),
        body    := jsonb_build_object('company_id', NEW.id)
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
