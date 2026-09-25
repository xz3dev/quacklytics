package insights

const Trend InsightType = "Trend"

type TrendInsightConfig struct {
	Series     *[]TrendSeries `json:"series"`
	TimeBucket TimeBucket     `json:"timeBucket"`
	Duration   string         `json:"duration"`
}

type TrendSeries struct {
	Name          string       `json:"name" gorm:"size:255;not null"`
	Visualisation string       `json:"visualisation" gorm:"size:255;not null;default:'line'"`
	Query         InsightQuery `json:"query" gorm:"type:json;not null"`
}
