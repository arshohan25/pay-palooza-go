
-- Ensure new users are NOT KYC-exempt by default (idempotent reaffirmation)
ALTER TABLE public.profiles ALTER COLUMN kyc_exempt SET DEFAULT false;

-- Rewrite admin_bulk_approve_addmoney with row-level locking + idempotency
CREATE OR REPLACE FUNCTION public.admin_bulk_approve_addmoney(
  p_request_ids uuid[],
  p_admin_note text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_row RECORD;
  v_ok INT := 0;
  v_fail INT := 0;
  v_skipped INT := 0;
  v_already INT := 0;
  v_errors JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOREACH v_id IN ARRAY p_request_ids LOOP
    BEGIN
      -- Row-level lock; skip rows currently being processed by another admin
      SELECT id, status, type INTO v_row
      FROM public.fund_requests
      WHERE id = v_id
      FOR UPDATE SKIP LOCKED;

      IF NOT FOUND THEN
        v_skipped := v_skipped + 1;
        v_errors := v_errors || jsonb_build_object('id', v_id, 'error', 'locked_or_missing');
        CONTINUE;
      END IF;

      -- Idempotency: already approved => count as already, do not double-credit
      IF v_row.status = 'approved' THEN
        v_already := v_already + 1;
        CONTINUE;
      END IF;

      IF v_row.status <> 'pending' THEN
        v_fail := v_fail + 1;
        v_errors := v_errors || jsonb_build_object('id', v_id, 'error', 'not_pending:' || v_row.status);
        CONTINUE;
      END IF;

      PERFORM public.admin_approve_fund_request(v_id, p_admin_note);
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      v_errors := v_errors || jsonb_build_object('id', v_id, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN json_build_object(
    'approved', v_ok,
    'failed', v_fail,
    'skipped_locked', v_skipped,
    'already_approved', v_already,
    'errors', v_errors
  );
END;
$function$;
