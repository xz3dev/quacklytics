package types

import (
	"database/sql/driver"
	"fmt"
	"github.com/marcboeker/go-duckdb"
	"strings"
)

type UUIDList []duckdb.UUID

// Value implements the driver.Value interface
func (u UUIDList) Value() (driver.Value, error) {

	if len(u) == 0 {
		return "[]", nil
	}

	var b strings.Builder
	b.WriteString("[")
	for i, uuid := range u {
		if i > 0 {
			b.WriteString(",")
		}

		b.WriteString(fmt.Sprintf("%x-%x-%x-%x-%x",
			uuid[0:4], uuid[4:6], uuid[6:8], uuid[8:10], uuid[10:16]))
	}
	b.WriteString("]")
	return b.String(), nil
}
