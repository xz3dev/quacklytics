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

func QuerySettings(db *gorm.DB) (map[model.ProjectSettingKey]string, error) {
	var settings []model.ProjectSetting
	err := db.Find(&settings).Error
	if err != nil {
		return nil, err
	}
	result := make(map[model.ProjectSettingKey]string, len(settings))
	for _, setting := range settings {
		result[setting.Key] = setting.Value
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
