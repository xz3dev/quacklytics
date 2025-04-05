package filecatalog

import (
	"analytics/model"
	"gorm.io/gorm"
	"time"
)

func ListAll(db *gorm.DB) ([]model.FileCatalogEntry, error) {
	var entries []model.FileCatalogEntry

	now := time.Now()

	if err := db.
		Where("valid_until is null").
		Or("valid_until > ?", now).
		Find(&entries).
		Error; err != nil {
		return nil, err
	}

	return entries, nil
}
