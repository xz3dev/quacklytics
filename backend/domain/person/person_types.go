package person

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type PersonProperties map[string]any
type PropertyTimestamps map[string]time.Time

type Person struct {
	Id                 string
	FirstSeen          time.Time
	Properties         PersonProperties
	PropertyTimestamps PropertyTimestamps
}

func (p PersonProperties) ApplyLatestProps(props PersonProperties, timestamps PropertyTimestamps, eventTime time.Time) bool {
	updated := false
	for key, value := range props {
		currentTimestamp, exists := timestamps[key]
		if exists && eventTime.Before(currentTimestamp) {
			continue
		}
		p[key] = value
		timestamps[key] = eventTime
		updated = true
	}
	return updated
}

func (p PersonProperties) Value() (driver.Value, error) {
	data, err := json.Marshal(p)
	if err != nil {
		return nil, err
	}
	return string(data), nil
}

func (p *PersonProperties) Scan(value interface{}) error {
	if value == nil {
		*p = nil
		return nil
	}

	var jsonStr string
	switch v := value.(type) {
	case map[string]interface{}:
		*p = PersonProperties(v)
		return nil
	case string:
		jsonStr = v
	case []byte:
		jsonStr = string(v)
	default:
		return fmt.Errorf("PersonProperties has invalid type: %T", v)
	}

	*p = make(PersonProperties)
	return json.Unmarshal([]byte(jsonStr), p)
}

func (p PropertyTimestamps) Value() (driver.Value, error) {
	data, err := json.Marshal(p)
	if err != nil {
		return nil, err
	}
	return string(data), nil
}

func (p *PropertyTimestamps) Scan(value interface{}) error {
	if value == nil {
		*p = nil
		return nil
	}

	var jsonStr string
	switch v := value.(type) {
	case map[string]interface{}:
		data, err := json.Marshal(v)
		if err != nil {
			return err
		}
		jsonStr = string(data)
	case string:
		jsonStr = v
	case []byte:
		jsonStr = string(v)
	default:
		return fmt.Errorf("PropertyTimestamps has invalid type: %T", v)
	}

	*p = make(PropertyTimestamps)
	return json.Unmarshal([]byte(jsonStr), p)
}
