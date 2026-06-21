-- Rate limit hits log (one row per allowed request)
CREATE TABLE public.rate_limit_hits (
  id BIGSERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  fn TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_hits_lookup
  ON public.rate_limit_hits (ip, fn, created_at DESC);

-- Edge functions use the service role; no end-user access.
GRANT ALL ON public.rate_limit_hits TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rate_limit_hits_id_seq TO service_role;

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only service_role (which bypasses RLS) may access this table.

-- Atomic check-and-record: returns { allowed, retry_after, minute_count, hour_count }.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_ip TEXT,
  p_fn TEXT,
  p_minute_limit INT,
  p_hour_limit INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minute_count INT;
  v_hour_count INT;
  v_oldest_in_minute TIMESTAMPTZ;
  v_oldest_in_hour TIMESTAMPTZ;
  v_retry_after INT;
BEGIN
  -- Opportunistic cleanup of rows for this IP/fn older than 1 hour.
  DELETE FROM public.rate_limit_hits
   WHERE ip = p_ip AND fn = p_fn AND created_at < now() - INTERVAL '1 hour';

  SELECT COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '1 minute'),
         COUNT(*),
         MIN(created_at) FILTER (WHERE created_at > now() - INTERVAL '1 minute'),
         MIN(created_at)
    INTO v_minute_count, v_hour_count, v_oldest_in_minute, v_oldest_in_hour
    FROM public.rate_limit_hits
   WHERE ip = p_ip AND fn = p_fn;

  IF v_minute_count >= p_minute_limit THEN
    v_retry_after := GREATEST(1,
      CEIL(EXTRACT(EPOCH FROM (v_oldest_in_minute + INTERVAL '1 minute' - now())))::INT);
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after', v_retry_after,
      'limit', p_minute_limit,
      'window', 'minute',
      'minute_count', v_minute_count,
      'hour_count', v_hour_count
    );
  END IF;

  IF v_hour_count >= p_hour_limit THEN
    v_retry_after := GREATEST(1,
      CEIL(EXTRACT(EPOCH FROM (v_oldest_in_hour + INTERVAL '1 hour' - now())))::INT);
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after', v_retry_after,
      'limit', p_hour_limit,
      'window', 'hour',
      'minute_count', v_minute_count,
      'hour_count', v_hour_count
    );
  END IF;

  INSERT INTO public.rate_limit_hits (ip, fn) VALUES (p_ip, p_fn);

  RETURN jsonb_build_object(
    'allowed', true,
    'minute_count', v_minute_count + 1,
    'hour_count', v_hour_count + 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INT) TO service_role;