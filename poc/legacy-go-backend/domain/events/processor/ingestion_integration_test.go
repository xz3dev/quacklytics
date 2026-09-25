package processor

import (
	"analytics/database/testsetup"
	"analytics/domain/events"
	"analytics/domain/queries"
	"analytics/domain/schema"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/zeebo/assert"
)

func TestProcessBatchPersistsEventsQueryableByEventsEndpoint(t *testing.T) {
	setup := testsetup.Setup(t, testsetup.TestSetupConfig{
		ProjectDB: true,
		DuckDB:    true,
	})
	defer setup.Dispose()

	projectID := "ingestion-test"
	sessionID := "session-1"
	personID := "person-1"
	timestamp := time.Date(2026, 5, 9, 12, 30, 0, 0, time.UTC)
	secondTimestamp := timestamp.Add(time.Minute)
	err := setup.ProjectDB.AutoMigrate(
		&schema.EventSchema{},
		&schema.EventSchemaProperty{},
		&schema.EventSchemaPropertyValue{},
	)
	assert.NoError(t, err)

	processor := NewProjectProcessor(projectID, setup.ProjectDB, &setup.DuckDB)
	processor.processBatch([]*events.EventInput{
		{
			EventType: "page_view",
			SessionId: &sessionID,
			PersonId:  &personID,
			Timestamp: timestamp,
			Properties: map[string]any{
				"path":  "/docs",
				"count": 2,
			},
			PersonProperties: map[string]any{
				"plan": "paid",
			},
		},
	})
	processor.processBatch([]*events.EventInput{
		{
			EventType: "button_click",
			SessionId: &sessionID,
			PersonId:  &personID,
			Timestamp: secondTimestamp,
			Properties: map[string]any{
				"button": "signup",
			},
			PersonProperties: map[string]any{
				"plan": "enterprise",
			},
		},
	})

	result, err := events.QueryEvents(&setup.DuckDB, &queries.EmptyQueryParams)
	assert.NoError(t, err)
	assert.Equal(t, 2, len(*result))

	eventsByType := make(map[string]events.EventOutput)
	for _, event := range *result {
		eventsByType[event.EventType] = event
	}

	event := eventsByType["page_view"]
	assert.Equal(t, "page_view", event.EventType)
	assert.Equal(t, sessionID, *event.SessionId)
	assert.Equal(t, personID, *event.PersonId)
	assert.Equal(t, timestamp, event.Timestamp)
	assert.Equal(t, "/docs", event.Properties["path"])
	assert.Equal(t, float64(2), event.Properties["count"])

	secondEvent := eventsByType["button_click"]
	assert.Equal(t, "button_click", secondEvent.EventType)
	assert.Equal(t, sessionID, *secondEvent.SessionId)
	assert.Equal(t, personID, *secondEvent.PersonId)
	assert.Equal(t, secondTimestamp, secondEvent.Timestamp)
	assert.Equal(t, "signup", secondEvent.Properties["button"])
}

// API decoding alone can hide double encoding. Assert the stored SQL types
// and nested extraction for both JSON columns at the ingestion boundary.
func TestPersistEventsStoresJSONObjects(t *testing.T) {
	setup := testsetup.Setup(t, testsetup.TestSetupConfig{ProjectDB: true, DuckDB: true})
	defer setup.Dispose()
	p := NewProjectProcessor("json-storage-test", setup.ProjectDB, &setup.DuckDB)
	p.PersistEvents([]*events.Event{
		{EventId: events.EventId{Id: uuid.New()}, EventInput: events.EventInput{
			EventType: "nested", Timestamp: time.Now().UTC(),
			Properties:       map[string]any{"path": "/docs", "nested": map[string]any{"count": 2}, "labels": []string{"first", "second"}, "enabled": true},
			PersonProperties: map[string]any{"plan": "paid", "profile": map[string]any{"country": "DE"}},
		}},
		{EventId: events.EventId{Id: uuid.New()}, EventInput: events.EventInput{
			EventType: "empty", Timestamp: time.Now().UTC(), Properties: map[string]any{}, PersonProperties: map[string]any{},
		}},
	})
	tx, err := setup.DuckDB.Tx()
	assert.NoError(t, err)
	defer tx.Rollback()
	var objectRows int
	err = tx.QueryRow(`SELECT count(*) FROM events WHERE json_type(properties)='OBJECT' AND json_type(person_properties)='OBJECT'`).Scan(&objectRows)
	assert.NoError(t, err)
	assert.Equal(t, 2, objectRows)
	var path, label, plan, country string
	var count int
	var enabled bool
	err = tx.QueryRow(`SELECT properties->>'path', CAST(json_extract(properties, '$.nested.count') AS INTEGER),
		properties->>'$.labels[1]', CAST(json_extract(properties, '$.enabled') AS BOOLEAN),
		person_properties->>'plan', person_properties->>'$.profile.country'
		FROM events WHERE event_type='nested'`).Scan(&path, &count, &label, &enabled, &plan, &country)
	assert.NoError(t, err)
	assert.Equal(t, "/docs", path)
	assert.Equal(t, 2, count)
	assert.Equal(t, "second", label)
	assert.Equal(t, true, enabled)
	assert.Equal(t, "paid", plan)
	assert.Equal(t, "DE", country)
}
