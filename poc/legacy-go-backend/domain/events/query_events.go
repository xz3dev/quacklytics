package events

import (
	"analytics/database/analyticsdb"
	"analytics/domain/queries"
	"analytics/log"
	"database/sql"
	"encoding/json"
	"fmt"
)

func QueryEvents(dbd analyticsdb.DuckDB, params *queries.QueryParams) (*[]EventOutput, error) {
	if params == nil {
		params = &queries.EmptyQueryParams
	}
	tx, err := dbd.Tx()
	if err != nil {
		log.Error("Error while creating transaction: ", err)
		return nil, err
	}
	defer tx.Commit()

	query, args := queries.BuildSQL(params)

	log.Debug("Query: %s, args: %v", query, args)

	rows, err := tx.Query(query, args...)
	if err != nil {
		log.Error("Error executing query:", err)
		return nil, err
	}
	defer rows.Close()

	events, err := parseEvents(rows)
	if err != nil {
		log.Error("Error parsing events:", err)
		return nil, err
	}

	return events, nil
}

func parseEvents(rows *sql.Rows) (*[]EventOutput, error) {
	var resultSet []EventOutput
	for rows.Next() {
		var event EventOutput
		var sessionId sql.NullString
		var personId sql.NullString
		var propertiesValue any
		if err := rows.Scan(
			&event.Id,
			&event.Timestamp,
			&event.EventType,
			&sessionId,
			&personId,
			&propertiesValue,
		); err != nil {
			log.Error(err.Error(), err)
			return nil, err
		}
		if sessionId.Valid {
			event.SessionId = &sessionId.String
		}
		if personId.Valid {
			event.PersonId = &personId.String
		}
		properties, err := ParseJSONProperties(propertiesValue)
		if err != nil {
			log.Error("Error parsing properties:", err)
			return nil, err
		}
		event.Properties = properties
		resultSet = append(resultSet, event)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &resultSet, nil
}

func ParseJSONProperties(value any) (map[string]any, error) {
	switch properties := value.(type) {
	case nil:
		return map[string]any{}, nil
	case map[string]any:
		return properties, nil
	case []byte:
		return unmarshalJSONProperties(properties)
	case string:
		return unmarshalJSONProperties([]byte(properties))
	default:
		return nil, fmt.Errorf("unsupported properties type %T", value)
	}
}

func unmarshalJSONProperties(value []byte) (map[string]any, error) {
	var properties map[string]any
	if err := json.Unmarshal(value, &properties); err != nil {
		return nil, err
	}
	if properties == nil {
		properties = map[string]any{}
	}
	return properties, nil
}
