package insights

import (
	"analytics/database/types"
	"analytics/internal/log"
	"gorm.io/gorm"
)

type SeriesInput struct {
	Name          string     `json:"name" gorm:"size:255;not null"`
	Visualisation string     `json:"visualisation" gorm:"size:255;not null;default:'line'"`
	Query         types.JSON `json:"query" gorm:"type:json;not null"`
}

type Series struct {
	InsightID uint `gorm:"index"`
	SeriesInput
	gorm.Model
}

func (s *Series) ApplyInput(input SeriesInput) {
	s.Name = input.Name
	s.Query = input.Query
}

func (i *Insight) UpdateSeries(db *gorm.DB) error {
	// First delete any existing series
	if err := db.Where("insight_id = ?", i.ID).Delete(&Series{}).Error; err != nil {
		return err
	}

	// Then create new series if they exist
	if i.Series != nil {
		for idx := range *i.Series {
			log.Info("Creating series %d, %d", idx, i.ID)
			(*i.Series)[idx].ID = 0 // clear id to force recreation
			(*i.Series)[idx].InsightID = i.ID
			if err := db.Create(&(*i.Series)[idx]).Error; err != nil {
				return err
			}
		}
	}
	return nil
}
