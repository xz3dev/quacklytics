package eventprocessor

import (
	"analytics/events"
	"analytics/internal/testsetup"
	"analytics/model"
	"analytics/schema"
	"github.com/google/uuid"
	"github.com/zeebo/assert"
	"testing"
	"time"
)

// Test that events with different distinct IDs yield different person IDs.
func TestDifferentDistinctIdResultsInDifferentPersonIds(t *testing.T) {
	s := testsetup.Setup(t)
	defer s.Dispose()

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

	p := events.NewProjectProcessor("test-runner", s.ProjectDB, &s.DuckDB)

	existingPersons, err := p.GetExistingPersons(testEvents)
	assert.NoError(t, err)

	e := NewEventProcessor(&Input{
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

// Test that a later event (with a higher timestamp) overwrites properties from an earlier event.
func TestOverwritingPropertiesBasedOnTimestamp(t *testing.T) {
	s := testsetup.Setup(t)
	defer s.Dispose()

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

	p := events.NewProjectProcessor("test-runner", s.ProjectDB, &s.DuckDB)

	existingPersons, err := p.GetExistingPersons(testEvents)
	assert.NoError(t, err)

	e := NewEventProcessor(&Input{
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
	s := testsetup.Setup(t)
	defer s.Dispose()

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

	p := events.NewProjectProcessor("test-runner", s.ProjectDB, &s.DuckDB)

	existingPersons, err := p.GetExistingPersons(testEvents)
	assert.NoError(t, err)

	e := NewEventProcessor(&Input{
		Events:          testEvents,
		ExistingPersons: existingPersons,
	})
	results, err := e.Process()
	assert.NoError(t, err)
	//// Verify that only the event with a distinct ID is processed
	assert.Equal(t, len(results.NewEvents), 1)
	assert.Equal(t, results.NewEvents[0].DistinctId, "id_1")
}

// Test that events without a distinct ID are silently dropped.
func TestAllEventsHavePersonId(t *testing.T) {
	s := testsetup.Setup(t)
	defer s.Dispose()

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

	p := events.NewProjectProcessor("test-runner", s.ProjectDB, &s.DuckDB)

	existingPersons, err := p.GetExistingPersons(testEvents)
	assert.NoError(t, err)

	e := NewEventProcessor(&Input{
		Events:          testEvents,
		ExistingPersons: existingPersons,
		EventSchema:     make(map[string]*schema.EventSchema),
	})
	results, err := e.Process()
	assert.NoError(t, err)

	for _, event := range results.NewEvents {
		if event.PersonId == uuid.Nil {
			t.Error("Event misses personId after processing")
		}
	}
}
