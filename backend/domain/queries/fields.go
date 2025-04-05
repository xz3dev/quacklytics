package queries

import (
	"fmt"
	"strconv"
	"time"
)

type FieldType string

const (
	StringField  FieldType = "string"
	NumberField  FieldType = "number"
	BooleanField FieldType = "boolean"
	DateField    FieldType = "date"
	JSONField    FieldType = "json"
)

var FieldTypes = map[string]FieldType{
	"id":         StringField,
	"timestamp":  DateField,
	"event_type": StringField,
	"user_id":    StringField,
	"properties": JSONField,
	// Add other fields as necessary
}

type FieldHandler interface {
	Parse(value string, operation OperationType) (interface{}, error)
	FormatSQL(field string, jsonProperty string, operation OperationType) string
}

type StringFieldHandler struct{}
type NumberFieldHandler struct{}
type BooleanFieldHandler struct{}
type DateFieldHandler struct{}
type JSONFieldHandler struct{}

func (h StringFieldHandler) Parse(value string, _ OperationType) (interface{}, error) {
	return value, nil
}

func (h NumberFieldHandler) Parse(value string, _ OperationType) (interface{}, error) {
	return strconv.ParseFloat(value, 64)
}

func (h BooleanFieldHandler) Parse(value string, _ OperationType) (interface{}, error) {
	return strconv.ParseBool(value)
}

func (h DateFieldHandler) Parse(value string, _ OperationType) (interface{}, error) {
	return time.Parse(time.RFC3339, value)
}

func (h JSONFieldHandler) Parse(value string, operation OperationType) (interface{}, error) {
	if isNumericOperation(operation) {
		return strconv.ParseFloat(value, 64)
	}
	valAsFloat, err := strconv.ParseFloat(value, 64)
	if err != nil {
		recover()
		return value, nil
	}
	return valAsFloat, nil
}

func (h StringFieldHandler) FormatSQL(field, _ string, _ OperationType) string {
	return field
}

func (h NumberFieldHandler) FormatSQL(field, _ string, _ OperationType) string {
	return field
}

func (h BooleanFieldHandler) FormatSQL(field, _ string, _ OperationType) string {
	return field
}

func (h DateFieldHandler) FormatSQL(field, _ string, _ OperationType) string {
	return fmt.Sprintf("CAST(%s AS TIMESTAMP)", field)
}

func (h JSONFieldHandler) FormatSQL(field, jsonProperty string, operation OperationType) string {
	if isNumericOperation(operation) {
		return fmt.Sprintf("CAST(json_extract(%s, '$.%s') AS DOUBLE)", field, jsonProperty)
	}
	return fmt.Sprintf("json_extract(%s, '$.%s')", field, jsonProperty)
}

var fieldHandlers = map[FieldType]FieldHandler{
	StringField:  StringFieldHandler{},
	NumberField:  NumberFieldHandler{},
	BooleanField: BooleanFieldHandler{},
	DateField:    DateFieldHandler{},
	JSONField:    JSONFieldHandler{},
}
