package model

import (
	"gorm.io/gorm"
	"log"
)

type InsightInput struct {
	Name   string    `json:"name" gorm:"size:255;not null"`
	Type   string    `json:"type" gorm:"size:255;not null;default:'Trend'"`
	Series *[]Series `json:"series"`
}

type Insight struct {
	Base
	InsightInput
}

func (i *Insight) ApplyInput(input InsightInput) {
	i.Name = input.Name
	if input.Series != nil {
		i.Series = input.Series
	}
}

func (i *Insight) UpdateSeries(db *gorm.DB) error {
	// First delete any existing series
	if err := db.Where("insight_id = ?", i.ID).Delete(&Series{}).Error; err != nil {
		return err
	}

	// Then create new series if they exist
	if i.Series != nil {
		for idx := range *i.Series {
			log.Printf("Creating series %d, %d", idx, i.ID)
			(*i.Series)[idx].ID = 0 // clear id to force recreation
			(*i.Series)[idx].InsightID = i.ID
			if err := db.Create(&(*i.Series)[idx]).Error; err != nil {
				return err
			}
		}
	}
	return nil
}
