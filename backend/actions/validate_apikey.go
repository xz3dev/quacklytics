package actions

import (
	"analytics/model"
	"gorm.io/gorm"
)

func ValidateAPIKey(appdb *gorm.DB, apiKey string) (string, error) {
	var key model.ApiKey
	err := appdb.Find(&key, "key = ?", apiKey).Error
	if err != nil {
		return "", err
	}
	return key.Project, nil
}
