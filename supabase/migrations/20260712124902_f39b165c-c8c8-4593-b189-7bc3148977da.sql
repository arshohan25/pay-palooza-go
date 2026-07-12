REVOKE EXECUTE ON FUNCTION public.get_agent_kyc_audit(UUID, INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_kyc_status_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agent_kyc_audit(UUID, INT) TO authenticated;