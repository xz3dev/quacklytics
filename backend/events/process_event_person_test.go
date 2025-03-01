package events

import (
	"analytics/internal/testsetup"
	"analytics/model"
	"github.com/zeebo/assert"
	"testing"
	"time"
)

func TestSameDistinctIdResultsInSamePersonId(t *testing.T) {
	s := testsetup.Setup(t)
	defer s.Dispose()

	assert.NotNil(t, s.ProjectDB)
	assert.NotNil(t, s.DuckDB)
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

	p := ProjectProcessor{
		projectID:  "test_runner",
		db:         s.ProjectDB,
		dbd:        &s.DuckDB,
		eventQueue: make(chan *model.EventInput, 1),
	}

	results2, err := p.ProcessPeopleDataBatch(testEvents)
	assert.NoError(t, err)
	assert.NotNil(t, results2)

	assert.Equal(t, results2[0].PersonId, results2[1].PersonId)
}

func Test2(t *testing.T) {
	s := testsetup.Setup(t)
	defer s.Dispose()

	assert.NotNil(t, s.ProjectDB)
	assert.NotNil(t, s.DuckDB)
	testEvents := []*model.EventInput{
		{
			EventType:  "test_type",
			DistinctId: "id_1",
			Timestamp:  time.Time{},
			Properties: map[string]any{
				"$set": map[string]any{
					"prop_1": 1,
				},
			},
		},
		{
			EventType:  "test_type",
			DistinctId: "id_1",
			Timestamp:  time.Time{},
			Properties: map[string]any{
				"$set": map[string]any{
					"prop_1": "a",
					"prop_2": 2,
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

	results2, err := p.ProcessPeopleDataBatch(testEvents)
	assert.NoError(t, err)
	assert.NotNil(t, results2)

	assert.Equal(t, results2[0].PersonId, results2[1].PersonId)
}
