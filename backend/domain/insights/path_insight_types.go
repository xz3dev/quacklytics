package insights

const Path InsightType = "Path"

type PathInsightConfig struct {
	Duration    string       `json:"duration"`
	AnchorQuery InsightQuery `json:"anchorQuery"`
	Direction   string       `json:"direction"`
	StepField   Field        `json:"stepField"`
	MaxSteps    int          `json:"maxSteps,omitempty"`
	Limit       int          `json:"limit,omitempty"`
}
