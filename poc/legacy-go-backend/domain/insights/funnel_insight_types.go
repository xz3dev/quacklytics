package insights

const Funnel InsightType = "Funnel"

type FunnelInsightConfig struct {
	Duration string       `json:"duration"`
	Steps    []FunnelStep `json:"steps"`
}

type FunnelStep struct {
	Id    string       `json:"id"`
	Name  string       `json:"name"`
	Order int          `json:"order"`
	Query InsightQuery `json:"query"`
}
