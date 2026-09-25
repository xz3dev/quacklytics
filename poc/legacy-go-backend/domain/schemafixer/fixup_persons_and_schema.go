package schemafixer

import (
	"analytics/database/analyticsdb"
	"errors"
)

func FixupPersonsAndSchema(project string) error {
	analyticsDb := analyticsdb.LookupTable[project]
	if analyticsDb == nil {
		return errors.New("project not found")
	}
	return nil
}
