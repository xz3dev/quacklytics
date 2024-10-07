package queries

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type OperationType string

const (
	Equals        OperationType = "eq"
	NotEquals     OperationType = "neq"
	GreaterThan   OperationType = "gt"
	LessThan      OperationType = "lt"
	GreaterEquals OperationType = "gte"
	LessEquals    OperationType = "lte"
	In            OperationType = "in"
	NotIn         OperationType = "nin"
	Contains      OperationType = "contains"
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

type QueryCondition struct {
	Field        string
	Operation    OperationType
	Value        interface{}
	FieldType    FieldType
	JSONProperty string
}

type QueryParams struct {
	Conditions []QueryCondition
}

var EmptyQueryParams = QueryParams{
	Conditions: make([]QueryCondition, 0),
}

func ExtractQueryParams(r *http.Request) (*QueryParams, error) {
	params := &QueryParams{}

	for key, values := range r.URL.Query() {
		parts := strings.SplitN(key, "__", 3)
		if len(parts) < 2 {
			continue
		}

		field := parts[0]
		operation := OperationType(parts[1])

		for _, value := range values {
			condition, err := createCondition(field, operation, value)
			if err != nil {
				return params, err
			}
			params.Conditions = append(params.Conditions, condition)
		}
	}

	return params, nil
}

func createCondition(field string, operation OperationType, value string) (QueryCondition, error) {
	var parsedValue interface{}
	var err error
	var jsonProperty string

	fieldParts := strings.SplitN(field, ".", 2)
	baseField := fieldParts[0]
	fieldType, ok := FieldTypes[baseField]
	if !ok {
		return QueryCondition{}, fmt.Errorf("unknown field: %s", baseField)
	}

	if fieldType == JSONField && len(fieldParts) == 2 {
		jsonProperty = fieldParts[1]
		if isNumericOperation(operation) {
			parsedValue, err = strconv.ParseFloat(value, 64)
		} else {
			parsedValue = value
		}
	} else {
		switch fieldType {
		case NumberField:
			parsedValue, err = strconv.ParseFloat(value, 64)
		case BooleanField:
			parsedValue, err = strconv.ParseBool(value)
		case DateField:
			parsedValue, err = time.Parse(time.RFC3339, value)
		default:
			parsedValue = value
		}
	}

	if err != nil {
		return QueryCondition{}, err
	}

	return QueryCondition{
		Field:        baseField,
		Operation:    operation,
		Value:        parsedValue,
		FieldType:    fieldType,
		JSONProperty: jsonProperty,
	}, nil
}

func BuildSQL(params *QueryParams) (string, []interface{}) {
	query := "select * from events where 1=1"
	var args []interface{}
	argCount := 0

	for _, condition := range params.Conditions {
		argCount++
		placeholder := fmt.Sprintf("$%d", argCount)

		var fieldExpr string
		if condition.FieldType == JSONField {
			// For numeric operations, cast to DOUBLE
			if isNumericOperation(condition.Operation) {
				fieldExpr = fmt.Sprintf("CAST(json_extract(%s, '$.%s') AS DOUBLE)",
					condition.Field, condition.JSONProperty)
			} else {
				fieldExpr = fmt.Sprintf("json_extract(%s, '$.%s')",
					condition.Field, condition.JSONProperty)
			}
		} else {
			fieldExpr = condition.Field
		}

		switch condition.Operation {
		case Equals:
			query += fmt.Sprintf(" AND %s = %s", fieldExpr, placeholder)
		case NotEquals:
			query += fmt.Sprintf(" AND %s != %s", fieldExpr, placeholder)
		case GreaterThan:
			query += fmt.Sprintf(" AND %s > %s", fieldExpr, placeholder)
		case LessThan:
			query += fmt.Sprintf(" AND %s < %s", fieldExpr, placeholder)
		case GreaterEquals:
			query += fmt.Sprintf(" AND %s >= %s", fieldExpr, placeholder)
		case LessEquals:
			query += fmt.Sprintf(" AND %s <= %s", fieldExpr, placeholder)
		case In:
			values := strings.Split(condition.Value.(string), ",")
			placeholders := make([]string, len(values))
			for i := range values {
				argCount++
				placeholders[i] = fmt.Sprintf("$%d", argCount)
				args = append(args, values[i])
			}
			query += fmt.Sprintf(" AND %s IN (%s)", fieldExpr, strings.Join(placeholders, ", "))
			continue // Skip the args append at the end
		case NotIn:
			values := strings.Split(condition.Value.(string), ",")
			placeholders := make([]string, len(values))
			for i := range values {
				argCount++
				placeholders[i] = fmt.Sprintf("$%d", argCount)
				args = append(args, values[i])
			}
			query += fmt.Sprintf(" AND %s NOT IN (%s)", fieldExpr, strings.Join(placeholders, ", "))
			continue // Skip the args append at the end
		case Contains:
			query += fmt.Sprintf(" AND %s LIKE '%%' || %s || '%%'", fieldExpr, placeholder)
		default:
			continue // Skip unknown operations
		}

		args = append(args, condition.Value)
	}

	return query, args
}

func isNumericOperation(op OperationType) bool {
	return op == GreaterThan || op == LessThan || op == GreaterEquals || op == LessEquals
}
