package actions

import (
	"analytics/database/appdb"
	"analytics/model"
	"analytics/schema"
	"gorm.io/gorm/clause"
	"log"
	"reflect"
)

func ApplySchemaChanges(events []*model.EventInput) {
	var eventTypeMap = make(map[string]bool)
	for _, event := range events {
		eventTypeMap[event.EventType] = true
	}

	uniqueEventTypes := make([]string, 0, len(eventTypeMap))
	for eventType := range eventTypeMap {
		uniqueEventTypes = append(uniqueEventTypes, eventType)
	}

	var schemas []schema.EventSchema
	queryResult := appdb.I.Where("event_type in ?", uniqueEventTypes).Find(&schemas)
	if queryResult.Error != nil {
		log.Println("Error fetching event schemas: ", queryResult.Error)
		return
	}

	var schemasByType = make(map[string]*schema.EventSchema, len(schemas))
	for _, schema := range schemas {
		schemasByType[schema.EventType] = &schema
	}

	// apply changes to schemasByType
	for _, event := range events {
		s, exists := schemasByType[event.EventType]
		if !exists {
			s = &schema.EventSchema{
				EventType:  event.EventType,
				Properties: []schema.EventSchemaProperty{},
			}
			schemasByType[event.EventType] = s
			result := appdb.I.Create(s)
			if result.Error != nil {
				log.Println("Error creating schema: ", result.Error)
			}
		}
		applyPropChanges(event, schemasByType[event.EventType])

		props := make([]schema.EventSchemaProperty, 0, len(event.Properties))
		for _, prop := range s.Properties {
			props = append(props, schema.EventSchemaProperty{
				Key:           prop.Key,
				Type:          prop.Type,
				EventSchemaID: prop.EventSchemaID,
			})
		}

		// update schema properties
		result := appdb.I.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "key"}, {Name: "event_schema_id"}},
			DoUpdates: clause.AssignmentColumns([]string{"type"}),
		}).CreateInBatches(&props, 100)
		if result.Error != nil {
			log.Println("Error upserting schema props: ", result.Error)
		}
	}
}

func applyPropChanges(e *model.EventInput, s *schema.EventSchema) {
	schemaPropsByKey := make(map[string]*schema.EventSchemaProperty)
	for _, prop := range s.Properties {
		schemaPropsByKey[prop.Key] = &prop
	}

	for key, value := range e.Properties {
		observedType := reflect.TypeOf(value).String()
		existingType, exists := schemaPropsByKey[key]
		if !exists {
			schemaPropsByKey[key] = &schema.EventSchemaProperty{
				Key:           key,
				Type:          observedType,
				EventSchemaID: s.ID,
			}
		} else {
			existingType.Type = observedType
		}
	}

	schemaProps := make([]schema.EventSchemaProperty, 0, len(schemaPropsByKey))
	for _, prop := range schemaPropsByKey {
		schemaProps = append(schemaProps, *prop)
	}

	s.Properties = schemaProps
}

//schema, exists := schemas[event.EventType]
//if !exists {
//	schema = &EventSchema{
//		EventType:  event.EventType,
//		Properties: make(map[string][]string),
//	}
//	schemas[event.EventType] = schema
//}
//
//for key, value := range event.Properties {
//	observedType := reflect.TypeOf(value).String()
//	types, exists := schema.Properties[key]
//	if !exists {
//		schema.Properties[key] = []string{observedType}
//	} else if !contains(types, observedType) {
//		schema.Properties[key] = append(types, observedType)
//	}
//}
