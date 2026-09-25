package types

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
)

type JSON json.RawMessage

func (q JSON) Value() (driver.Value, error) {
	if len(q) == 0 {
		return nil, nil
	}
	b := bytes.TrimPrefix(q, []byte("\xef\xbb\xbf")) // remove BOM
	return json.RawMessage(b).MarshalJSON()
}

func (q *JSON) Scan(value interface{}) error {
	b, ok := value.([]byte)
	if !ok {
		return errors.New(fmt.Sprint("Failed to unmarshal JSONB value:", value))
	}

	bytesWithoutBOM := bytes.TrimPrefix(b, []byte("\xef\xbb\xbf"))

	result := json.RawMessage{}
	err := json.Unmarshal(bytesWithoutBOM, &result)
	*q = JSON(result)
	return err
}

// MarshalJSON implements json.Marshaler
func (j JSON) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return []byte(j), nil
}

// UnmarshalJSON implements json.Unmarshaler
func (j *JSON) UnmarshalJSON(data []byte) error {
	if j == nil {
		return errors.New("JSON: UnmarshalJSON on nil pointer")
	}
	*j = append((*j)[0:0], data...)
	return nil
}
