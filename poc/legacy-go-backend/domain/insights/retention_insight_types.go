package insights

const Retention InsightType = "Retention"

type RetentionInsightConfig struct {
	Duration        string       `json:"duration"`
	CohortBucket    TimeBucket   `json:"cohortBucket"`
	ActivationQuery InsightQuery `json:"activationQuery"`
	ReturnQuery     InsightQuery `json:"returnQuery"`
	MaxPeriods      int          `json:"maxPeriods,omitempty"`
}
