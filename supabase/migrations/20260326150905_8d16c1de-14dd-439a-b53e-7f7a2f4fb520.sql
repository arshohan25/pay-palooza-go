
CREATE OR REPLACE FUNCTION public.generate_wallet_id_from_phone(p_phone text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  seed1 text;
  seed2 text;
  h1 bigint := 0;
  h2 bigint := 0;
  h1_int int;
  h2_int int;
  block1 text := '';
  block2 text := '';
  i int;
BEGIN
  seed1 := p_phone;
  seed2 := p_phone || 'salt';
  
  -- hash block 1 (replicate JS: h = ((h << 5) - h + charCode) | 0)
  FOR i IN 1..length(seed1) LOOP
    h1 := (h1 * 32) - h1 + ascii(substring(seed1 FROM i FOR 1));
    -- Simulate JS | 0: reduce to signed 32-bit range
    h1 := ((h1 + 2147483648) % 4294967296) - 2147483648;
  END LOOP;
  h1_int := h1::int;
  FOR i IN 0..3 LOOP
    block1 := block1 || substring(chars FROM (abs(h1_int >> (i * 5)) % 26) + 1 FOR 1);
  END LOOP;
  
  -- hash block 2
  FOR i IN 1..length(seed2) LOOP
    h2 := (h2 * 32) - h2 + ascii(substring(seed2 FROM i FOR 1));
    h2 := ((h2 + 2147483648) % 4294967296) - 2147483648;
  END LOOP;
  h2_int := h2::int;
  FOR i IN 0..3 LOOP
    block2 := block2 || substring(chars FROM (abs(h2_int >> (i * 5)) % 26) + 1 FOR 1);
  END LOOP;
  
  RETURN 'EZP-' || block1 || '-' || block2;
END;
$function$;
