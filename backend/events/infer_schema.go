package events

import (
	"analytics/log"
	"analytics/model"
	"analytics/schema"
	"fmt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"reflect"
	"regexp"
	"strings"
	"time"
)

func ApplySchemaChanges(events []*model.EventInput, db *gorm.DB) {
	uniqueEventTypes := extractUniqueEventTypes(events)
	schemas := fetchExistingSchemas(uniqueEventTypes, db)
	if schemas == nil {
		return
	}

	schemasByType := makeSchemaMap(schemas)
	updateSchemasFromEvents(events, schemasByType)
	persistAllSchemas(schemasByType, db)
}

func persistAllSchemas(schemasByType map[string]*schema.EventSchema, db *gorm.DB) {
	err := db.Transaction(func(tx *gorm.DB) error {
		// Persist each schema and its properties
		for _, s := range schemasByType {
			// Create or update the schema
			if s.ID == 0 {
				if err := tx.Create(s).Error; err != nil {
					return err
				}
			}

			// Persist properties
			if err := persistPropertiesAndUpdateIDs(s, tx); err != nil {
				return err
			}

			// Collect and persist all property values
			if err := persistPropertyValues(s.Properties, tx); err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		log.Error("Error persisting schemas:", err)
	}
}

func fetchExistingSchemas(eventTypes []string, db *gorm.DB) []schema.EventSchema {
	var schemas []schema.EventSchema
	if err := db.Where("event_type in ?", eventTypes).Find(&schemas).Error; err != nil {
		log.Error("Error fetching event schemas:", err)
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
) {
	for _, event := range events {
		schema := ensureSchemaExistsInMemory(event.EventType, schemasByType)
		updateSchemaProperties(event, schema)
	}
}

func ensureSchemaExistsInMemory(
	eventType string,
	schemasByType map[string]*schema.EventSchema,
) *schema.EventSchema {
	s, exists := schemasByType[eventType]
	if exists {
		return s
	}

	s = &schema.EventSchema{
		EventType:  eventType,
		Properties: []schema.EventSchemaProperty{},
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
	observedType := determineType(key, value)

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

func determineType(key string, value interface{}) string {
	_, isMap := value.(map[string]interface{})
	if isMap {
		return "json"
	}

	timestamp := "2006-01-02 15:04:05.000"
	if _, err := time.Parse(timestamp, fmt.Sprintf("%v", value)); err == nil {
		return "timestamp"
	}
	if _, err := time.Parse(time.RFC3339, fmt.Sprintf("%v", value)); err == nil {
		return "timestamp"
	}

	normalizedType := normalizeType(reflect.TypeOf(value).String())
	// extra check to make really sure it's a number
	if normalizedType == "number" {
		isNumberRegex := regexp.MustCompile(`^[+-]?([0-9]*[.])?[0-9]+$`)
		isReallyNumber := isNumberRegex.MatchString(fmt.Sprintf("%v", value))
		if isReallyNumber {
			return "number"
		} else {
			return "string"
		}
	}
	return normalizedType
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
	err := db.Transaction(func(tx *gorm.DB) error {
		// First persist the properties and get their IDs
		if err := persistPropertiesAndUpdateIDs(s, db); err != nil {
			log.Error("Error persisting properties:", err)
		}

		// Now persist values with the correct property IDs
		persistPropertyValues(s.Properties, db)
		return nil
	})
	if err != nil {
		log.Error("Error persisting schema:", err)
	}
}

func persistPropertiesAndUpdateIDs(s *schema.EventSchema, db *gorm.DB) error {
	if len(s.Properties) == 0 {
		return nil
	}
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

func persistPropertyValues(properties []schema.EventSchemaProperty, db *gorm.DB) error {
	var allValues []schema.EventSchemaPropertyValue

	// Collect all values from all properties
	for _, prop := range properties {
		values := prepareValuesForPersistence(prop)
		allValues = append(allValues, values...)
	}

	// Only persist if we have values
	if len(allValues) > 0 {
		if err := persistValues(allValues, db); err != nil {
			log.Error("Error persisting property values:", err)
			return err
		}
	}
	return nil
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
