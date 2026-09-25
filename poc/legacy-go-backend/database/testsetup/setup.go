package testsetup

import (
	"analytics/log"
	"gorm.io/gorm"
	"testing"
)

type TestSetupConfig struct {
	ProjectDB bool
	DuckDB    bool
}

func Setup(t *testing.T, conf TestSetupConfig) TestSetup {
	log.Init()

	var testDB *gorm.DB
	if conf.ProjectDB {
		testDB = createTestDB(t)
	}
	var testDuckDB TestDuckDB
	if conf.DuckDB {
		testDuckDB = createTestAnalyticsDB(t)
	}
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
