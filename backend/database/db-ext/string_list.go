package db_ext

import (
	"database/sql/driver"
	"strings"
)

type StringList []string

// Value implements the driver.Value interface
func (u StringList) Value() (driver.Value, error) {

	if len(u) == 0 {
		return "[]", nil
	}

	var b strings.Builder
	b.WriteString("[")
	for i, s := range u {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString(s)
	}
	b.WriteString("]")
	return b.String(), nil
}
