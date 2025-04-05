package testsetup

import (
	"analytics/internal/log"
	"gorm.io/gorm"
	"testing"
)

func Setup(t *testing.T) TestSetup {
	log.Init()
	testDB := createTestDB(t)
	testDuckDB := createTestAnalyticsDB(t)
	return TestSetup{
		ProjectDB: testDB,
		DuckDB:    testDuckDB,
	}
}

type TestSetup struct {
	ProjectDB *gorm.DB
	DuckDB    TestDuckDB
}

func (t *TestSetup) Dispose() {
	t.DuckDB.Close()

	db, _ := t.ProjectDB.DB()
	db.Close()
}
