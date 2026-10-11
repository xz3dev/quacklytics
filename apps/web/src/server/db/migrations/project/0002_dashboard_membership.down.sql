UPDATE insights SET json = json_set(json, '$.id', id);
UPDATE dashboards SET json = json_set(json, '$.id', id, '$.insights', json(COALESCE((
  SELECT json_group_array(json(value)) FROM (
    SELECT i.json AS value FROM dashboard_insights m JOIN insights i ON i.id = m.insight_id
    WHERE m.dashboard_id = dashboards.id ORDER BY m.position
  )
), '[]')));
UPDATE dashboards SET json = json_set(json, '$.layout', json((
  SELECT json_group_array(json(value)) FROM (
    SELECT m.layout AS value FROM dashboard_insights m
    WHERE m.dashboard_id = dashboards.id AND m.layout IS NOT NULL ORDER BY m.position
  )
))) WHERE EXISTS (SELECT 1 FROM dashboard_insights m WHERE m.dashboard_id = dashboards.id AND m.layout IS NOT NULL);
DROP TABLE dashboard_insights;
