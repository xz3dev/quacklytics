package processor

import (
	"analytics/domain/events"
	"analytics/internal/log"
	"analytics/schema"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func FetchExistingSchemas(eventTypes []string, db *gorm.DB) []schema.EventSchema {
	var schemas []schema.EventSchema
	if err := db.Where("event_type in ?", eventTypes).Find(&schemas).Error; err != nil {
		log.Error("Error fetching event schemas:", err)
		return nil
	}
	return schemas
}

func extractUniqueEventTypes(events []*events.EventInput) []string {
	eventTypeMap := make(map[string]bool)
	for _, event := range events {
		eventTypeMap[event.EventType] = true
	}

	uniqueEventTypes := make([]string, 0, len(eventTypeMap))
	for eventType := range eventTypeMap {
		uniqueEventTypes = append(uniqueEventTypes, eventType)
	}
	return uniqueEventTypes
}

func MakeSchemaMap(schemas []schema.EventSchema) map[string]*schema.EventSchema {
	schemaMap := make(map[string]*schema.EventSchema, len(schemas))
	for _, schema := range schemas {
		schemaMap[schema.EventType] = &schema
	}
	return schemaMap
}

func prepareValuesForPersistence(prop schema.EventSchemaProperty) []schema.EventSchemaPropertyValue {
	values := make([]schema.EventSchemaPropertyValue, 0, len(prop.Values))
	for _, val := range prop.Values {
		values = append(values, schema.EventSchemaPropertyValue{
			EventSchemaPropertyID: prop.ID,
			Value:                 val.Value,
		})
	}
	return values
}

func persistValues(values []schema.EventSchemaPropertyValue, db *gorm.DB) error {
	return db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "event_schema_property_id"}, {Name: "value"}},
		DoNothing: true,
	}).CreateInBatches(&values, 100).Error
}
