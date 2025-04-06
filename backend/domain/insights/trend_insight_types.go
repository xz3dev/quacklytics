package insights

const Trend InsightType = "Trend"

type TrendInsightConfig struct {
	Series     *[]TrendSeries `json:"series"`
	TimeBucket TimeBucket     `json:"timeBucket"`
	Duration   string         `json:"duration"`
}

type TrendSeries struct {
	Name          string     `json:"name" gorm:"size:255;not null"`
	Visualisation string     `json:"visualisation" gorm:"size:255;not null;default:'line'"`
	Query         TrendQuery `json:"query" gorm:"type:json;not null"`
}

type SortDirection string

const (
	SortAscending  SortDirection = "ASC"
	SortDescending SortDirection = "DESC"
)

type OrderBy struct {
	Field     Field         `json:"field"`
	Direction SortDirection `json:"direction"`
}

type TrendQuery struct {
	Select       []Field       `json:"select,omitempty"`
	Filters      []FieldFilter `json:"filters,omitempty"`
	GroupBy      []Field       `json:"groupBy,omitempty"`
	OrderBy      []OrderBy     `json:"orderBy,omitempty"`
	Aggregations []Aggregation `json:"aggregations,omitempty"`
	Limit        *int          `json:"limit,omitempty"`
	Offset       *int          `json:"offset,omitempty"`
}

type Field struct {
	Name     string `json:"name"`
	DataType string `json:"dataType,omitempty"`
	Alias    string `json:"alias,omitempty"`
}

type Operator string

const (
	OperatorEquals              Operator = "="
	OperatorNotEquals           Operator = "!="
	OperatorGreaterThan         Operator = ">"
	OperatorGreaterThanOrEquals Operator = ">="
	OperatorLessThan            Operator = "<"
	OperatorLessThanOrEquals    Operator = "<="
	OperatorLike                Operator = "LIKE"
	OperatorContains            Operator = "CONTAINS"
)

type FieldFilter struct {
	Field    Field       `json:"field"`
	Operator Operator    `json:"operator"`
	Value    interface{} `json:"value"`
}

type AggregationFunction string

const (
	AggregationCount AggregationFunction = "COUNT"
	AggregationSum   AggregationFunction = "SUM"
	AggregationAvg   AggregationFunction = "AVG"
	AggregationMin   AggregationFunction = "MIN"
	AggregationMax   AggregationFunction = "MAX"
)

type Aggregation struct {
	Function AggregationFunction `json:"function"`
	Field    Field               `json:"field"`
	Distinct bool                `json:"distinct,omitempty"`
	Alias    string              `json:"alias,omitempty"`
}
