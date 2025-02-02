package auth

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
)

// UUID is a custom type that wraps uuid.UUID
type UUID struct {
	uuid.UUID
}

// Value implements the driver.Valuer interface
func (u UUID) Value() (driver.Value, error) {
	return u.UUID.String(), nil
}

// Scan implements the sql.Scanner interface
func (u *UUID) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	s, ok := value.(string)
	if !ok {
		return fmt.Errorf("invalid UUID format")
	}
	uuid, err := uuid.Parse(s)
	if err != nil {
		return err
	}
	u.UUID = uuid
	return nil
}

// MarshalJSON implements the json.Marshaler interface
func (u UUID) MarshalJSON() ([]byte, error) {
	return json.Marshal(u.UUID.String())
}

// UnmarshalJSON implements the json.Unmarshaler interface
func (u *UUID) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	uuid, err := uuid.Parse(s)
	if err != nil {
		return err
	}
	u.UUID = uuid
	return nil
}
