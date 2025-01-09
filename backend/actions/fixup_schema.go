package actions

import (
	"analytics/database/analyticsdb"
	"analytics/events"
	"analytics/model"
	"analytics/schema"
	"analytics/util"
	"fmt"
	"gorm.io/gorm"
	"log"
)

func FixupSchema(project string, db *gorm.DB) error {
	if err := resetSchemaTables(db); err != nil {
		return fmt.Errorf("failed to reset schema tables: %w", err)
	}

	analyticsDb := analyticsdb.LookupTable[project]
	if analyticsDb == nil {
		return &FixupError{
			Message: "test",
		}
	}
	e, err := QueryEvents(project, nil)
	if err != nil {
		return err
	}

	util.ProcessBatched(e, 10000, func(batch []model.Event) {
		log.Printf("Processing batch of %d events", len(batch))
		inputs := make([]*model.EventInput, len(batch))
		for i, event := range batch {
			inputs[i] = &event.EventInput
		}
		events.ApplySchemaChanges(inputs, db)
	})
	return nil
}

type FixupError struct {
	Message string
}

func (e *FixupError) Error() string {
	return fmt.Sprintf("%s", e.Message)
}

func resetSchemaTables(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Delete all records using GORM
		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).
			Delete(&schema.EventSchemaPropertyValue{}).Error; err != nil {
			return fmt.Errorf("failed to clear property values: %w", err)
		}

		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).
			Delete(&schema.EventSchemaProperty{}).Error; err != nil {
			return fmt.Errorf("failed to clear properties: %w", err)
		}

		if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).
			Delete(&schema.EventSchema{}).Error; err != nil {
			return fmt.Errorf("failed to clear schemas: %w", err)
		}

		return nil
	})
}
