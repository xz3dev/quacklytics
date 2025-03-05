package events

import (
	"analytics/log"
	"analytics/schema"
	"gorm.io/gorm"
)

func (p *ProjectProcessor) persistAllSchemas(schemasByType map[string]*schema.EventSchema) {
	err := p.db.Transaction(func(tx *gorm.DB) error {
		// Persist each schema and its properties
		for _, s := range schemasByType {
			// Create or update the schema
			if s.ID == 0 {
				if err := tx.Create(s).Error; err != nil {
					return err
				}
			}

			// Persist properties
			if err := persistPropertiesAndUpdateIDs(s, tx); err != nil {
				return err
			}

			// Collect and persist all property values
			if err := persistPropertyValues(s.Properties, tx); err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		log.Error("Error persisting schemas:", err)
	}
}

func persistPropertiesAndUpdateIDs(s *schema.EventSchema, db *gorm.DB) error {
	if len(s.Properties) == 0 {
		return nil
	}
	for i := range s.Properties {
		prop := &s.Properties[i]
		result := db.Where(schema.EventSchemaProperty{
			EventSchemaID: s.ID,
			Key:           prop.Key,
		}).Attrs(schema.EventSchemaProperty{
			Type: prop.Type,
		}).FirstOrCreate(prop)

		if result.Error != nil {
			return result.Error
		}
	}
	return nil
}

func persistPropertyValues(properties []schema.EventSchemaProperty, db *gorm.DB) error {
	var allValues []schema.EventSchemaPropertyValue

	// Collect all values from all properties
	for _, prop := range properties {
		values := prepareValuesForPersistence(prop)
		allValues = append(allValues, values...)
	}

	// Only persist if we have values
	if len(allValues) > 0 {
		if err := persistValues(allValues, db); err != nil {
			log.Error("Error persisting property values:", err)
			return err
		}
	}
	return nil
}
