//go:build ingestionpoc

package processor

import (
	"context"
	"database/sql/driver"
	"os"
	"strings"

	"github.com/duckdb/duckdb-go/v2"
)

// Match SQLite's per-connection statement cache without changing the production
// identity algorithm. Each benchmark connection is used serially.
type pocDuckConnector struct{ driver.Connector }

func (c pocDuckConnector) Connect(ctx context.Context) (driver.Conn, error) {
	conn, err := c.Connector.Connect(ctx)
	if err != nil {
		return nil, err
	}
	return &pocDuckConn{Conn: conn.(*duckdb.Conn), statements: make(map[string]driver.Stmt)}, nil
}

type pocDuckConn struct {
	*duckdb.Conn
	statements map[string]driver.Stmt
}

func (c *pocDuckConn) cached(ctx context.Context, query string) (driver.Stmt, error) {
	if stmt := c.statements[query]; stmt != nil {
		return stmt, nil
	}
	stmt, err := c.Conn.PrepareContext(ctx, query)
	if err == nil {
		c.statements[query] = stmt
	}
	return stmt, err
}
func (c *pocDuckConn) ExecContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	if strings.Contains(query, ";") {
		return c.Conn.ExecContext(ctx, query, args)
	}
	stmt, err := c.cached(ctx, query)
	if err != nil {
		return nil, err
	}
	return stmt.(driver.StmtExecContext).ExecContext(ctx, args)
}
func (c *pocDuckConn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	stmt, err := c.cached(ctx, query)
	if err != nil {
		return nil, err
	}
	return stmt.(driver.StmtQueryContext).QueryContext(ctx, args)
}
func (c *pocDuckConn) Close() error {
	for _, stmt := range c.statements {
		if err := stmt.Close(); err != nil {
			return err
		}
	}
	return c.Conn.Close()
}
func pocDuckCacheEnabled() bool { return os.Getenv("POC_DUCKDB_CACHE") != "off" }
