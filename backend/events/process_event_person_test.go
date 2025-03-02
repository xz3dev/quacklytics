package events

import (
	"analytics/events/eventprocessor"
	"analytics/internal/testsetup"
	"analytics/model"
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

	p := ProjectProcessor{
		projectID:  "test_runner",
		db:         s.ProjectDB,
		dbd:        &s.DuckDB,
		eventQueue: make(chan *model.EventInput, 1),
	}

	results, err := p.ProcessPeopleDataBatch(testEvents)
	assert.NoError(t, err)
	assert.NotNil(t, results)
	// Verify that the person IDs for distinct ids "id_1" and "id_2" are different.
	t.Helper()
	if results[0].PersonId == results[1].PersonId {
		t.Fatal("Person IDs should be different")
	}
}

// Test that processing an empty event list does not create any new persons.
func TestEventProcessorWithEmptyEventList(t *testing.T) {
	s := testsetup.Setup(t)
	defer s.Dispose()

	testEvents := []*model.EventInput{}

	p := ProjectProcessor{
		projectID:  "test_runner",
		db:         s.ProjectDB,
		dbd:        &s.DuckDB,
		eventQueue: make(chan *model.EventInput, 1),
	}

	existingPersons, err := p.getExistingPersons(testEvents)
	assert.NoError(t, err)

	e := eventprocessor.EventProcessor{
		Input: eventprocessor.Input{
			Events:          testEvents,
			ExistingPersons: existingPersons,
		},
	}

	err = e.Process()
	assert.NoError(t, err)
	// Expect no new persons to be created.
	assert.Equal(t, len(e.Output.NewPersons), 0)
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

	p := ProjectProcessor{
		projectID:  "test_runner",
		db:         s.ProjectDB,
		dbd:        &s.DuckDB,
		eventQueue: make(chan *model.EventInput, 1),
	}

	existingPersons, err := p.getExistingPersons(testEvents)
	assert.NoError(t, err)

	e := eventprocessor.EventProcessor{
		Input: eventprocessor.Input{
			Events:          testEvents,
			ExistingPersons: existingPersons,
		},
	}

	err = e.Process()
	assert.NoError(t, err)

	expectedProperties := model.PersonProperties{
		"prop_a": "second",
	}

	person := e.Output.NewPersons["id_1"]
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

	p := ProjectProcessor{
		projectID:  "test_runner",
		db:         s.ProjectDB,
		dbd:        &s.DuckDB,
		eventQueue: make(chan *model.EventInput, 1),
	}

	existingPersons, err := p.getExistingPersons(testEvents)
	assert.NoError(t, err)

	e := eventprocessor.EventProcessor{
		Input: eventprocessor.Input{
			Events:          testEvents,
			ExistingPersons: existingPersons,
		},
	}

	err = e.Process()
	assert.NoError(t, err)
	// Verify that only the event with a distinct ID is processed
	assert.Equal(t, len(e.Output.NewEvents), 1)
	assert.Equal(t, e.Output.NewEvents[0].DistinctId, "id_1")
}
