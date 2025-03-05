package eventprocessor

import (
	"analytics/internal/testsetup"
	"analytics/model"
	"analytics/schema"
	"github.com/zeebo/assert"
	"testing"
	"time"
)

func TestSchemaDiff(t *testing.T) {
	s := testsetup.Setup(t)
	defer s.Dispose()

	t1 := time.Now()
	t2 := t1.Add(1 * time.Minute)

	testEvents := []*model.EventInput{
		{
			EventType:  "test_type",
			DistinctId: "id_1",
			Timestamp:  t2,
			Properties: map[string]any{
				"prop_a": "second",
			},
		},
		{
			EventType:  "test_type",
			DistinctId: "id_1",
			Timestamp:  t1,
			Properties: map[string]any{
				"prop_a": "first",
				"prop_b": 0,
			},
		},
	}

	e := NewEventProcessor(&Input{
		Events:          testEvents,
		ExistingPersons: make(map[string]*model.Person),
		EventSchema: map[string]*schema.EventSchema{
			"test_type": {
				ID:        0,
				EventType: "test_type",
				Properties: []schema.EventSchemaProperty{
					{
						ID:            0,
						EventSchemaID: 0,
						Key:           "existing",
						Type:          "string",
						Values: []schema.EventSchemaPropertyValue{
							{
								ID:                    0,
								EventSchemaPropertyID: 0,
								Value:                 "test",
							},
						},
					},
				},
			},
		},
	})
	results, err := e.Process()
	assert.NoError(t, err)

	newSchema := results.Schema
	assert.NotNil(t, newSchema)

	entry0 := newSchema["test_type"].Properties[0]
	assert.NotNil(t, entry0)
	assert.Equal(t, entry0.Key, "existing")
	assert.Equal(t, entry0.Type, "string")

	entry1 := newSchema["test_type"].Properties[1]
	assert.NotNil(t, entry1)
	assert.Equal(t, entry1.Key, "prop_a")
	assert.Equal(t, entry1.Type, "string")

	entry2 := newSchema["test_type"].Properties[2]
	assert.NotNil(t, entry2)
	assert.Equal(t, entry2.Key, "prop_b")
	assert.Equal(t, entry2.Type, "number")
}
