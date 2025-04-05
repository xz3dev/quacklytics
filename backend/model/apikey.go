package model

import "analytics/database/types"

type ApiKey struct {
	types.Base
	Key     string `json:"key" gorm:"uniqueIndex"`
	Project string `json:"project" gorm:"index"`
}
