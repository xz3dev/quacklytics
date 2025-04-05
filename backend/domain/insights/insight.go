package insights

import (
	"analytics/database/types"
	"gorm.io/gorm"
	"time"
)

type InsightInput struct {
	Name     string     `json:"name" gorm:"size:255;not null"`
	Type     string     `json:"type" gorm:"size:255;not null;default:'Trend'"`
	Favorite bool       `json:"favorite" gorm:"default:false"`
	Series   *[]Series  `json:"series"`
	Config   types.JSON `json:"config" gorm:"type:json;not null;default:'{}'"`
}

type Insight struct {
	ID uint `gorm:"primarykey" json:"id"`
	InsightInput
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt"`
}

func (i *Insight) ApplyInput(input InsightInput) {
	i.Name = input.Name
	i.Favorite = input.Favorite
	if input.Series != nil {
		i.Series = input.Series
	}
	if input.Config != nil {
		i.Config = input.Config
	}
}
