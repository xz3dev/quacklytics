package pipeline

import (
	"analytics/domain/events"
	"analytics/domain/schema"
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"time"
)

// schemaDiff holds the current event schemas and any updates.
type schemaDiff struct {
	EventSchema map[string]*schema.EventSchema
}

func (sd *schemaDiff) Name() string {
	return "SchemaDiff"
}

func (sd *schemaDiff) Process(ctx *PipelineContext) error {
	for _, event := range ctx.InputEvents {
		schema := getOrCreateSchema(event.EventType, sd.EventSchema)
		mergeEventPropertiesIntoSchema(event, schema)
	}
	return nil
}

func getOrCreateSchema(
	eventType string,
	schemasByType map[string]*schema.EventSchema,
) *schema.EventSchema {
	if schema, exists := schemasByType[eventType]; exists {
		return schema
	}
	newSchema := &schema.EventSchema{
		EventType:  eventType,
		Properties: []schema.EventSchemaProperty{},
	}
	schemasByType[eventType] = newSchema
	return newSchema
}

func mergeEventPropertiesIntoSchema(event *events.EventInput, schema *schema.EventSchema) {
	propertyMap := createPropertyMap(schema.Properties)
	for key, value := range event.Properties {
		updatePropertyValue(key, value, propertyMap, schema.ID)
	}
	schema.Properties = mapToSlice(propertyMap)
}

func createPropertyMap(properties []schema.EventSchemaProperty) map[string]*schema.EventSchemaProperty {
	propMap := make(map[string]*schema.EventSchemaProperty)
	for _, prop := range properties {
		propCopy := prop
		propMap[prop.Key] = &propCopy
	}
	return propMap
}

func updatePropertyValue(key string, value interface{}, propertyMap map[string]*schema.EventSchemaProperty, schemaID int) {
	if value == nil {
		return
	}
	detectedType := detectValueType(value)
	valueStr := fmt.Sprintf("%v", value)

	prop, exists := propertyMap[key]
	if !exists {
		prop = &schema.EventSchemaProperty{
			Key:           key,
			Type:          detectedType,
			EventSchemaID: schemaID,
			Values:        []schema.EventSchemaPropertyValue{},
		}
		propertyMap[key] = prop
	} else {
		prop.Type = detectedType
	}

	appendUniqueValue(prop, valueStr)
}

func detectValueType(value interface{}) string {
	if _, isMap := value.(map[string]interface{}); isMap {
		return "json"
	}

	timestampFormat := "2006-01-02 15:04:05.000"
	if _, err := time.Parse(timestampFormat, fmt.Sprintf("%v", value)); err == nil {
		return "timestamp"
	}
	if _, err := time.Parse(time.RFC3339, fmt.Sprintf("%v", value)); err == nil {
		return "timestamp"
	}

	normalized := normalizeType(reflect.TypeOf(value).String())
	if normalized == "number" {
		numberRegex := regexp.MustCompile(`^[+-]?([0-9]*[.])?[0-9]+$`)
		if numberRegex.MatchString(fmt.Sprintf("%v", value)) {
			return "number"
		}
		return "string"
	}
	return normalized
}

func appendUniqueValue(prop *schema.EventSchemaProperty, value string) {
	for _, existing := range prop.Values {
		if existing.Value == value {
			return
		}
	}
	prop.Values = append(prop.Values, schema.EventSchemaPropertyValue{Value: value})
}

func mapToSlice(propertyMap map[string]*schema.EventSchemaProperty) []schema.EventSchemaProperty {
	properties := make([]schema.EventSchemaProperty, 0, len(propertyMap))
	for _, prop := range propertyMap {
		properties = append(properties, *prop)
	}
	return properties
}

func normalizeType(goType string) string {
	if strings.Contains(goType, "int") || strings.Contains(goType, "double") || strings.Contains(goType, "float") {
		return "number"
	}
	return "string"
}
