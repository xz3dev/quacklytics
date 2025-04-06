package insights

const Value InsightType = "Value"

type ValueInsightConfig struct {
	Series   *TrendSeries `json:"series"`
	Duration string       `json:"duration"`
}
