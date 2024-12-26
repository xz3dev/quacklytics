package events

import (
	"analytics/model"
	"analytics/schema"
	"fmt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"log"
	"reflect"
	"strings"
)

func ApplySchemaChanges(events []*model.EventInput, db *gorm.DB) {
	uniqueEventTypes := extractUniqueEventTypes(events)
	schemas := fetchExistingSchemas(uniqueEventTypes, db)
	if schemas == nil {
		return
	}

	schemasByType := makeSchemaMap(schemas)
	updateSchemasFromEvents(events, schemasByType, db)
}

func fetchExistingSchemas(eventTypes []string, db *gorm.DB) []schema.EventSchema {
	var schemas []schema.EventSchema
	if err := db.Where("event_type in ?", eventTypes).Find(&schemas).Error; err != nil {
		log.Println("Error fetching event schemas:", err)
		return nil
	}
	return schemas
}

func extractUniqueEventTypes(events []*model.EventInput) []string {
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

func makeSchemaMap(schemas []schema.EventSchema) map[string]*schema.EventSchema {
	schemaMap := make(map[string]*schema.EventSchema, len(schemas))
	for _, schema := range schemas {
		schemaMap[schema.EventType] = &schema
	}
	return schemaMap
}

func updateSchemasFromEvents(
	events []*model.EventInput,
	schemasByType map[string]*schema.EventSchema,
	db *gorm.DB,
) {
	for _, event := range events {
		schema := ensureSchemaExists(event.EventType, schemasByType, db)
		if schema == nil {
			continue
		}

		updateSchemaProperties(event, schema)
		persistSchemaChanges(schema, db)
	}
}

func ensureSchemaExists(
	eventType string,
	schemasByType map[string]*schema.EventSchema,
	db *gorm.DB,
) *schema.EventSchema {
	s, exists := schemasByType[eventType]
	if exists {
		return s
	}

	s = &schema.EventSchema{
		EventType:  eventType,
		Properties: []schema.EventSchemaProperty{},
	}
	if err := db.Create(s).Error; err != nil {
		log.Println("Error creating schema:", err)
		return nil
	}

	schemasByType[eventType] = s
	return s
}

func updateSchemaProperties(event *model.EventInput, s *schema.EventSchema) {
	propsByKey := makePropertyMap(s.Properties)

	for key, value := range event.Properties {
		updateProperty(key, value, propsByKey, s.ID)
	}

	s.Properties = convertMapToSlice(propsByKey)
}

func makePropertyMap(properties []schema.EventSchemaProperty) map[string]*schema.EventSchemaProperty {
	propMap := make(map[string]*schema.EventSchemaProperty)
	for _, prop := range properties {
		propMap[prop.Key] = &prop
	}
	return propMap
}

func updateProperty(key string, value interface{}, propsByKey map[string]*schema.EventSchemaProperty, schemaID int) {
	observedType := normalizeType(reflect.TypeOf(value).String())
	strValue := fmt.Sprintf("%v", value)

	prop, exists := propsByKey[key]
	if !exists {
		prop = &schema.EventSchemaProperty{
			Key:           key,
			Type:          observedType,
			EventSchemaID: schemaID,
			Values:        []schema.EventSchemaPropertyValue{},
		}
		propsByKey[key] = prop
	} else {
		prop.Type = observedType
	}

	addValueIfNotExists(prop, strValue)
}

func addValueIfNotExists(prop *schema.EventSchemaProperty, value string) {
	for _, existing := range prop.Values {
		if existing.Value == value {
			return
		}
	}
	prop.Values = append(prop.Values, schema.EventSchemaPropertyValue{Value: value})
}

func convertMapToSlice(propMap map[string]*schema.EventSchemaProperty) []schema.EventSchemaProperty {
	props := make([]schema.EventSchemaProperty, 0, len(propMap))
	for _, prop := range propMap {
		props = append(props, *prop)
	}
	return props
}

func persistSchemaChanges(s *schema.EventSchema, db *gorm.DB) {
	// First persist the properties and get their IDs
	if err := persistPropertiesAndUpdateIDs(s, db); err != nil {
		log.Println("Error persisting properties:", err)
		return
	}

	// Now persist values with the correct property IDs
	persistPropertyValues(s.Properties, db)
}

func persistPropertiesAndUpdateIDs(s *schema.EventSchema, db *gorm.DB) error {
	for i := range s.Properties {
		prop := &s.Properties[i]
		result := db.Where(schema.EventSchemaProperty{
			EventSchemaID: s.ID,
			Key:           prop.Key,
		}).Attrs(schema.EventSchemaProperty{
			Type: prop.Type,
		}).FirstOrCreate(prop)

		if result.Error != nil {
			return result.Error
		}
	}
	return nil
}

func persistPropertyValues(properties []schema.EventSchemaProperty, db *gorm.DB) {
	for _, prop := range properties {
		// Now we can be sure prop.ID is set correctly
		values := prepareValuesForPersistence(prop)
		if len(values) > 0 {
			if err := persistValues(values, db); err != nil {
				log.Println("Error persisting property values:", err)
			}
		}
	}
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

func normalizeType(t string) string {
	if strings.Contains(t, "int") {
		return "number"
	}
	if strings.Contains(t, "double") {
		return "number"
	}
	if strings.Contains(t, "float") {
		return "number"
	}
	return "string"
}
