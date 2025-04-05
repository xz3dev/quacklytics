package apikeys

import (
	"gorm.io/gorm"
)

func ValidateAPIKey(appdb *gorm.DB, apiKey string) (string, error) {
	var key ApiKey
	err := appdb.Find(&key, "key = ?", apiKey).Error
	if err != nil {
		return "", err
	}
	return key.Project, nil
}
