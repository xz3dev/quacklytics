package projects

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	Name          ProjectSettingKey = "name"
	Partition     ProjectSettingKey = "partition"
	AutoLoadRange ProjectSettingKey = "autoload"
)

func QuerySettings(projectId string, db *gorm.DB) (map[ProjectSettingKey]string, error) {
	var settings []ProjectSetting
	err := db.Find(&settings).Error
	if err != nil {
		return nil, err
	}
	result := make(map[ProjectSettingKey]string, len(settings))
	for _, setting := range settings {
		result[setting.Key] = setting.Value
	}

	defaults := map[ProjectSettingKey]string{
		Name:          projectId,
		Partition:     "",
		AutoLoadRange: "6",
	}

	for key, defaultValue := range defaults {
		if _, exists := result[key]; !exists {
			result[key] = defaultValue
		}
	}
	return result, nil
}

func UpdateSetting(db *gorm.DB, key ProjectSettingKey, value string) error {
	setting := ProjectSetting{
		Key:   key,
		Value: value,
	}
	if err := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value"}),
	}).Where("key = ?", setting.Key).Save(&setting).Error; err != nil {
		return err
	}
	return nil
}
