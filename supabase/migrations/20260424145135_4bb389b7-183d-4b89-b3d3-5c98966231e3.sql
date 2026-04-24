DROP FUNCTION IF EXISTS public.get_data_quality_samples(text, integer);

GRANT EXECUTE ON FUNCTION public.get_data_quality_samples(text, integer, integer) TO authenticated;