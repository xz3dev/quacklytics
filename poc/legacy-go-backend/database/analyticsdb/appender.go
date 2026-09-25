package analyticsdb

import "database/sql/driver"

type DuckDBAppender interface {
	Flush() error

	Close() error

	AppendRow(args ...driver.Value) error
}
