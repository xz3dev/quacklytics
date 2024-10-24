package model

type InsightInput struct {
	Name   string    `json:"name" gorm:"size:255;not null"`
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
