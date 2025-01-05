package model

type Dashboard struct {
	Base
	Name string `gorm:"size:255;not null" json:"name"`
	DashboardInput
	Insights []Insight `gorm:"many2many:dashboard_insights;joinForeignKey:DashboardID;JoinReferences:InsightID" json:"insights"`
	Home     bool      `json:"home" gorm:"default:false"`
}

type DashboardInsight struct {
	DashboardID uint `gorm:"primaryKey"`
	InsightID   uint `gorm:"primaryKey"`
	Sort        int  `gorm:"not null;default:0"`
}

type DashboardInput struct {
	Name     string `json:"name" gorm:"size:255;not null"`
	Favorite bool   `json:"favorite" gorm:"default:false"`
}

func (m *Dashboard) ApplyInput(input DashboardInput) {
	m.Name = input.Name
	m.Favorite = input.Favorite
}
