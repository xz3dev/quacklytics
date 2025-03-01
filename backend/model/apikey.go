package model

type ApiKey struct {
	Base
	Key     string `json:"key" gorm:"uniqueIndex"`
	Project string `json:"project" gorm:"index"`
}
