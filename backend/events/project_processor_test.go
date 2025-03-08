package events

import (
	"analytics/events/eventprocessor"
	"analytics/model"
	"analytics/schema"
	"github.com/google/uuid"
	"github.com/zeebo/assert"
	"testing"
	"time"
)

// Test that events with different distinct IDs yield different person IDs.
func TestDifferentDistinctIdResultsInDifferentPersonIds(t *testing.T) {
	testEvents := []*model.EventInput{
		{
			EventType:  "test_type",
			DistinctId: "id_1",
			Timestamp:  time.Time{},
		},
		{
			EventType:  "test_type",
			DistinctId: "id_2",
			Timestamp:  time.Time{},
		},
	}

	existingPersons := make(map[string]*model.Person)

	e := eventprocessor.NewEventProcessor(&eventprocessor.Input{
		Events:          testEvents,
		ExistingPersons: existingPersons,
		EventSchema:     make(map[string]*schema.EventSchema),
	})
	results, err := e.Process()
	assert.NoError(t, err)
	if results.NewPersons["id_1"].Id == results.NewPersons["id_2"].Id {
		t.Helper()
		t.Fail()
	}
}

// Test that events with different distinct IDs yield different person IDs.
func TestEqualDistinctIdResultsInEqualPersonIds(t *testing.T) {

	testEvents := []*model.EventInput{
		{
			EventType:  "test_type",
			DistinctId: "id_1",
			Timestamp:  time.Time{},
		},
		{
			EventType:  "test_type",
			DistinctId: "id_1",
			Timestamp:  time.Time{},
		},
	}

	e := eventprocessor.NewEventProcessor(&eventprocessor.Input{
		Events:          testEvents,
		ExistingPersons: make(map[string]*model.Person),
		EventSchema:     make(map[string]*schema.EventSchema),
	})
	results, err := e.Process()
	assert.NoError(t, err)

	id1 := results.NewPersons[results.NewEvents[0].DistinctId].Id
	id2 := results.NewPersons[results.NewEvents[1].DistinctId].Id
	assert.Equal(t, id1, id2)
}

// Test that events with different distinct IDs yield different person IDs.
func TestExistingDistinctIdIsReused(t *testing.T) {
	testEvents := []*model.EventInput{
		{
			EventType:  "test_type",
			DistinctId: "id_1",
			Timestamp:  time.Time{},
		},
	}

	testUuid := uuid.MustParse("9ad9d3b9-25a3-44bf-82c1-e61c3c7ee19c")

	e := eventprocessor.NewEventProcessor(&eventprocessor.Input{
		Events: testEvents,
		ExistingPersons: map[string]*model.Person{
			"id_1": {
				Id:         testUuid,
				FirstSeen:  time.Time{},
				Properties: nil,
			},
		},
		EventSchema: make(map[string]*schema.EventSchema),
	})
	results, err := e.Process()
	assert.NoError(t, err)

	// no person should have been created nor updated as the id exists and no Properties is nil
	assert.Equal(t, len(results.UpdatedPersons), 0)
	assert.Equal(t, len(results.NewPersons), 0)
}

// Test that a later event (with a higher timestamp) overwrites properties from an earlier event.
func TestOverwritingPropertiesBasedOnTimestamp(t *testing.T) {
	t1 := time.Now()
	t2 := t1.Add(1 * time.Minute)

	// intentionally wrong order
	testEvents := []*model.EventInput{
		{
			EventType:  "test_type",
			DistinctId: "id_1",
			Timestamp:  t2,
			Properties: map[string]any{
				"$set": map[string]any{
					"prop_a": "second",
				},
			},
		},
		{
			EventType:  "test_type",
			DistinctId: "id_1",
			Timestamp:  t1,
			Properties: map[string]any{
				"$set": map[string]any{
					"prop_a": "first",
				},
			},
		},
	}

	existingPersons := make(map[string]*model.Person)

	e := eventprocessor.NewEventProcessor(&eventprocessor.Input{
		Events:          testEvents,
		ExistingPersons: existingPersons,
		EventSchema:     make(map[string]*schema.EventSchema),
	})

	results, err := e.Process()
	assert.NoError(t, err)

	expectedProperties := model.PersonProperties{
		"prop_a": "second",
	}

	person := results.NewPersons["id_1"]
	assert.NotNil(t, person)
	assert.DeepEqual(t, person.Properties, expectedProperties)
}

// Test that events without a distinct ID are silently dropped.
func TestEventWithoutDistinctIdIsDropped(t *testing.T) {
	testEvents := []*model.EventInput{
		{
			EventType: "should_be_dropped",
			Timestamp: time.Now(),
		},
		{
			EventType:  "test_type",
			DistinctId: "id_1",
			Timestamp:  time.Now(),
		},
	}

	existingPersons := make(map[string]*model.Person)

	e := eventprocessor.NewEventProcessor(&eventprocessor.Input{
		Events:          testEvents,
		ExistingPersons: existingPersons,
		EventSchema:     make(map[string]*schema.EventSchema),
	})
	results, err := e.Process()
	assert.NoError(t, err)
	//// Verify that only the event with a distinct ID is processed
	assert.Equal(t, len(results.NewEvents), 1)
	assert.Equal(t, results.NewEvents[0].DistinctId, "id_1")
}

func TestIdentify(t *testing.T) {
	testEvents := []*model.EventInput{
		{
			EventType:  "$identify",
			DistinctId: "id_2",
			Timestamp:  time.Time{},
			Properties: map[string]any{
				"$anon_distinct_id": "id_1",
			},
		},
	}

	testPersonId := uuid.MustParse("9ad9d3b9-25a3-44bf-82c1-e61c3c7ee19c")

	existingPersons := map[string]*model.Person{
		"id_1": {
			Id:         testPersonId,
			FirstSeen:  time.Time{},
			Properties: nil,
		},
	}

	e := eventprocessor.NewEventProcessor(&eventprocessor.Input{
		Events:          testEvents,
		ExistingPersons: existingPersons,
		EventSchema:     make(map[string]*schema.EventSchema),
	})

	results, err := e.Process()
	assert.NoError(t, err)
	assert.Equal(t, len(results.MappedPersons), 1)
	assert.Equal(t, results.MappedPersons["id_2"].Id, testPersonId)
}
