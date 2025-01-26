package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"time"
)

type PersonProperties map[string]any

type Person struct {
	Id         uuid.UUID
	FirstSeen  time.Time
	Properties PersonProperties
}

func (p PersonProperties) ApplySetProps(props PersonProperties) {
	for key, value := range props {
		p[key] = value
	}
}

func (p PersonProperties) ApplySetOnceProps(props PersonProperties) {
	for key, value := range props {
		if p[key] == nil {
			p[key] = value
		}
	}
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
