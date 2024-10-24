package model

type Project struct {
	Base
	Name string `gorm:"size:255;not null"`
}
