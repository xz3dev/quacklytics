package projects

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ProjectSetting struct {
	Key   ProjectSettingKey
	Value string
}

type ProjectSettingKey string

const (
	Name      ProjectSettingKey = "name"
	Partition ProjectSettingKey = "partition"
)

func QuerySettings(db *gorm.DB) (map[ProjectSettingKey]string, error) {
	var settings []ProjectSetting
	err := db.Find(&settings).Error
	if err != nil {
		return nil, err
	}
	result := make(map[ProjectSettingKey]string, len(settings))
	for _, setting := range settings {
		result[setting.Key] = setting.Value
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
