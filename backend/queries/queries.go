package queries

import (
	"fmt"
	"net/http"
	"strings"
)

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
	fieldParts := strings.SplitN(field, ".", 2)
	baseField := fieldParts[0]
	fieldType, ok := FieldTypes[baseField]
	if !ok {
		return QueryCondition{}, fmt.Errorf("unknown field: %s", baseField)
	}

	handler, ok := fieldHandlers[fieldType]
	if !ok {
		return QueryCondition{}, fmt.Errorf("no handler for field type: %s", fieldType)
	}

	parsedValue, err := handler.Parse(value, operation)
	if err != nil {
		return QueryCondition{}, err
	}

	jsonProperty := ""
	if fieldType == JSONField && len(fieldParts) == 2 {
		jsonProperty = fieldParts[1]
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
		handler := fieldHandlers[condition.FieldType]
		fieldExpr := handler.FormatSQL(condition.Field, condition.JSONProperty, condition.Operation)

		argCount++

		op, exists := GetOperation(condition.Operation)
		if !exists {
			continue // Skip unknown operations
		}

		placeholder := fmt.Sprintf("$%d", argCount)

		switch op.Type {
		case In, NotIn:
			values := strings.Split(condition.Value.(string), ",")
			placeholders := make([]string, len(values))
			for i := range values {
				argCount++
				placeholders[i] = fmt.Sprintf("$%d", argCount)
				args = append(args, values[i])
			}
			placeholder = fmt.Sprintf("(%s)", strings.Join(placeholders, ", "))
		case Contains:
			placeholder = fmt.Sprintf("'%%' || %s || '%%'", placeholder)
		}

		query += fmt.Sprintf(" AND %s %s %s", fieldExpr, op.SQL, placeholder)

		if op.Type != In && op.Type != NotIn {
			args = append(args, condition.Value)
		}
	}

	return query, args
}
