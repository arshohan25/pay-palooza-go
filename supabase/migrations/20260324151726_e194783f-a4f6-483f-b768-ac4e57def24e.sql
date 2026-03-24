INSERT INTO global_feature_toggles (feature_key, label, description, is_enabled, sort_order, visibility)
VALUES ('team_session_timeout_minutes', 'Team Session Timeout', '30', true, 999, 'visible')
ON CONFLICT DO NOTHING;