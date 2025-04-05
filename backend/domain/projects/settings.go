package projects

import (
	"analytics/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	Name          model.ProjectSettingKey = "name"
	Partition     model.ProjectSettingKey = "partition"
	AutoLoadRange model.ProjectSettingKey = "autoload"
)

func QuerySettings(projectId string, db *gorm.DB) (map[model.ProjectSettingKey]string, error) {
	var settings []model.ProjectSetting
	err := db.Find(&settings).Error
	if err != nil {
		return nil, err
	}
	result := make(map[model.ProjectSettingKey]string, len(settings))
	for _, setting := range settings {
		result[setting.Key] = setting.Value
	}

	defaults := map[model.ProjectSettingKey]string{
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

func UpdateSetting(db *gorm.DB, key model.ProjectSettingKey, value string) error {
	setting := model.ProjectSetting{
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
