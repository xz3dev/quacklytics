package pipeline

import (
	"analytics/domain/events"
	"analytics/model"
	"analytics/schema"
	"github.com/zeebo/assert"
	"testing"
	"time"
)

func TestSchemaDiff(t *testing.T) {
	t1 := time.Now()
	t2 := t1.Add(1 * time.Minute)

	testEvents := []*events.EventInput{
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

	e := New(&Input{
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

	properties := newSchema["test_type"].Properties

	findProperty := func(key string) *schema.EventSchemaProperty {
		for i := range properties {
			if properties[i].Key == key {
				return &properties[i]
			}
		}
		return nil
	}

	// Assertions for "existing" property
	existingProp := findProperty("existing")
	assert.NotNil(t, existingProp)
	assert.Equal(t, existingProp.Key, "existing")
	assert.Equal(t, existingProp.Type, "string")

	// Assertions for "prop_a" property
	propA := findProperty("prop_a")
	assert.NotNil(t, propA)
	assert.Equal(t, propA.Key, "prop_a")
	assert.Equal(t, propA.Type, "string")

	// Assertions for "prop_b" property
	propB := findProperty("prop_b")
	assert.NotNil(t, propB)
	assert.Equal(t, propB.Key, "prop_b")
	assert.Equal(t, propB.Type, "number")
}
