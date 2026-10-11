CREATE TABLE dashboard_insights (
  dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  insight_id INTEGER NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK(position >= 0),
  layout TEXT CHECK(layout IS NULL OR json_valid(layout)),
  PRIMARY KEY(dashboard_id, insight_id),
  UNIQUE(dashboard_id, position)
);
CREATE INDEX dashboard_insights_insight ON dashboard_insights(insight_id);
-- Keep the first occurrence of each live insight, in its original order.
INSERT INTO dashboard_insights(dashboard_id, insight_id, position, layout)
SELECT d.id, i.id, MIN(CAST(member.key AS INTEGER)),
  (SELECT item.value FROM json_each(d.json, '$.layout') item
   WHERE json_extract(item.value, '$.insightId') = i.id LIMIT 1)
FROM dashboards d, json_each(d.json, '$.insights') member
JOIN insights i ON i.id = json_extract(member.value, '$.id')
GROUP BY d.id, i.id;
UPDATE dashboards SET json = json_remove(json, '$.id', '$.insights', '$.layout');
UPDATE insights SET json = json_remove(json, '$.id');
