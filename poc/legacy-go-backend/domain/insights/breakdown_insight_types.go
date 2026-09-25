package insights

const Breakdown InsightType = "Breakdown"

type BreakdownInsightConfig struct {
	Duration    string        `json:"duration"`
	Dimension   Field         `json:"dimension"`
	Aggregation Aggregation   `json:"aggregation"`
	Filters     []FieldFilter `json:"filters,omitempty"`
	Limit       int           `json:"limit,omitempty"`
}
