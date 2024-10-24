package model

import (
	"gorm.io/gorm"
)

type SeriesInput struct {
	Name  string `json:"name" gorm:"size:255;not null"`
	Query JSON   `json:"query" gorm:"type:json;not null"`
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
