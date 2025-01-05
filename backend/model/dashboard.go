package model

type Dashboard struct {
	Base
	Name string `gorm:"size:255;not null" json:"name"`
	DashboardInput
	Insights []Insight `gorm:"many2many:dashboard_insights;" json:"insights"`
}

type DashboardInput struct {
	Name     string `json:"name" gorm:"size:255;not null"`
	Favorite bool   `json:"favorite" gorm:"default:false"`
}
