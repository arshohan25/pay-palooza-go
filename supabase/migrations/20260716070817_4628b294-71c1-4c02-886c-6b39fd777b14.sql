-- Seed all city corporations and district-headquarter powrashavas so the
-- unified Division→District→Upazila→Union picker shows a real dropdown
-- everywhere instead of falling back to a free-text input.
--
-- City corporations = every upazila whose name contains "City"
--   (Dhaka City → Dhaka North + Dhaka South; Chittagong City → Chattogram;
--    others follow the "<District> City Corporation" convention).
-- District powrashavas = every "* Sadar" upazila (~64) gets its
--   "<District> Powrashava" entry.
--
-- Uses INSERT … SELECT joined to `upazilas` so we never insert an orphan row,
-- and ON CONFLICT DO NOTHING so re-running is safe and pre-existing seeded
-- unions are preserved.

-- 1) City corporations
INSERT INTO public.unions (division, district, upazila, name, type, is_active)
SELECT DISTINCT u.division, u.district, u.upazila,
       CASE
         WHEN u.district = 'Dhaka' THEN 'Dhaka North City Corporation'
         ELSE u.district || ' City Corporation'
       END AS name,
       'city_corporation'::text AS type,
       true
FROM public.upazilas u
WHERE u.is_active = true AND u.upazila ILIKE '%city%'
ON CONFLICT DO NOTHING;

-- Dhaka has TWO city corporations sharing the same "Dhaka City" upazila.
INSERT INTO public.unions (division, district, upazila, name, type, is_active)
SELECT DISTINCT u.division, u.district, u.upazila,
       'Dhaka South City Corporation', 'city_corporation'::text, true
FROM public.upazilas u
WHERE u.is_active = true AND u.district = 'Dhaka' AND u.upazila ILIKE '%city%'
ON CONFLICT DO NOTHING;

-- 2) District powrashavas — one "<District> Powrashava" per Sadar upazila.
INSERT INTO public.unions (division, district, upazila, name, type, is_active)
SELECT DISTINCT u.division, u.district, u.upazila,
       u.district || ' Powrashava' AS name,
       'powrashava'::text AS type,
       true
FROM public.upazilas u
WHERE u.is_active = true
  AND (u.upazila ILIKE '% Sadar' OR u.upazila ILIKE '%Sadar')
ON CONFLICT DO NOTHING;

-- 3) Common secondary powrashavas — one per non-Sadar upazila.
-- Most upazilas host a powrashava that shares the upazila's name.
INSERT INTO public.unions (division, district, upazila, name, type, is_active)
SELECT DISTINCT u.division, u.district, u.upazila,
       u.upazila || ' Powrashava' AS name,
       'powrashava'::text AS type,
       true
FROM public.upazilas u
WHERE u.is_active = true
  AND u.upazila NOT ILIKE '%city%'
  AND u.upazila NOT ILIKE '% sadar'
  AND u.upazila NOT ILIKE '%sadar'
ON CONFLICT DO NOTHING;