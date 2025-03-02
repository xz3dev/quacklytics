package eventprocessor

import (
	"analytics/model"
	"analytics/schema"
	"fmt"
	"reflect"
	"regexp"
	"strings"
	"time"
)

// SchemaDiff holds the current event schemas and any updates.
type SchemaDiff struct {
	EventSchema map[string]*schema.EventSchema
}

// Process applies the schema diff. (Stub implementation.)
func (sd *SchemaDiff) Process(ctx *PipelineContext) error {
	mergeEventsIntoSchemas(ctx.InputEvents, sd.EventSchema)
	return nil
}

// MergeEventsIntoSchemas iterates over event inputs and merges their properties into the corresponding event schemas.
func mergeEventsIntoSchemas(
	events []*model.EventInput,
	schemasByType map[string]*schema.EventSchema,
) {
	for _, event := range events {
		schema := GetOrCreateSchema(event.EventType, schemasByType)
		MergeEventPropertiesIntoSchema(event, schema)
	}
}

// GetOrCreateSchema retrieves an existing schema for the given event type or creates a new one if it doesn't exist.
func GetOrCreateSchema(
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

// MergeEventPropertiesIntoSchema updates the schema by merging properties from the event.
func MergeEventPropertiesIntoSchema(event *model.EventInput, schema *schema.EventSchema) {
	propertyMap := CreatePropertyMap(schema.Properties)
	for key, value := range event.Properties {
		UpdatePropertyValue(key, value, propertyMap, schema.ID)
	}
	schema.Properties = MapToSlice(propertyMap)
}

// CreatePropertyMap converts a slice of schema properties into a map keyed by property key.
func CreatePropertyMap(properties []schema.EventSchemaProperty) map[string]*schema.EventSchemaProperty {
	propMap := make(map[string]*schema.EventSchemaProperty)
	for _, prop := range properties {
		// Copy the value to avoid referencing the loop variable directly.
		propCopy := prop
		propMap[prop.Key] = &propCopy
	}
	return propMap
}

// UpdatePropertyValue creates or updates a property in the schema with the value from the event.
func UpdatePropertyValue(key string, value interface{}, propertyMap map[string]*schema.EventSchemaProperty, schemaID int) {
	if value == nil {
		return
	}
	detectedType := DetectValueType(value)
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
		// Update the type based on the most recent observation.
		prop.Type = detectedType
	}

	AppendUniqueValue(prop, valueStr)
}

// DetectValueType returns a string representing the detected type of the value.
func DetectValueType(value interface{}) string {
	// Check if the value is a JSON-like object.
	if _, isMap := value.(map[string]interface{}); isMap {
		return "json"
	}

	// Check for timestamp formats.
	timestampFormat := "2006-01-02 15:04:05.000"
	if _, err := time.Parse(timestampFormat, fmt.Sprintf("%v", value)); err == nil {
		return "timestamp"
	}
	if _, err := time.Parse(time.RFC3339, fmt.Sprintf("%v", value)); err == nil {
		return "timestamp"
	}

	// Determine and normalize the type using reflection.
	normalized := NormalizeType(reflect.TypeOf(value).String())
	if normalized == "number" {
		numberRegex := regexp.MustCompile(`^[+-]?([0-9]*[.])?[0-9]+$`)
		if numberRegex.MatchString(fmt.Sprintf("%v", value)) {
			return "number"
		}
		return "string"
	}
	return normalized
}

// AppendUniqueValue adds the given value to the property's list if it does not already exist.
func AppendUniqueValue(prop *schema.EventSchemaProperty, value string) {
	for _, existing := range prop.Values {
		if existing.Value == value {
			return
		}
	}
	prop.Values = append(prop.Values, schema.EventSchemaPropertyValue{Value: value})
}

// MapToSlice converts a map of properties back to a slice.
func MapToSlice(propertyMap map[string]*schema.EventSchemaProperty) []schema.EventSchemaProperty {
	properties := make([]schema.EventSchemaProperty, 0, len(propertyMap))
	for _, prop := range propertyMap {
		properties = append(properties, *prop)
	}
	return properties
}

// NormalizeType converts the Go type string to a simpler schema type ("number" or "string").
func NormalizeType(goType string) string {
	if strings.Contains(goType, "int") || strings.Contains(goType, "double") || strings.Contains(goType, "float") {
		return "number"
	}
	return "string"
}
