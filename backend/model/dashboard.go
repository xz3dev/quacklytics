package model

type Dashboard struct {
	Base
	Name     string    `gorm:"size:255;not null" json:"name"`
	Insights []Insight `gorm:"many2many:dashboard_insights;" json:"insights"`
}
