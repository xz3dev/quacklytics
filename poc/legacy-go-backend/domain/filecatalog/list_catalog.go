package filecatalog

import (
	"gorm.io/gorm"
	"time"
)

func ListAll(db *gorm.DB) ([]FileCatalogEntry, error) {
	var entries []FileCatalogEntry

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
