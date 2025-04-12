package insights

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"gorm.io/gorm"
	"time"
)

type InsightType string

type InsightInput struct {
	Name     string         `json:"name" gorm:"size:255;not null"`
	Type     InsightType    `json:"type" gorm:"size:255;not null;default:'Trend'"`
	Favorite *bool          `json:"favorite" gorm:"default:false"`
	Config   *InsightConfig `json:"config" gorm:"type:json;null"`
}

type Insight struct {
	ID uint `gorm:"primarykey" json:"id"`
	InsightInput
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt"`
}

type InsightConfig struct {
	TrendConf  *TrendInsightConfig  `json:"trend,omitempty"`
	ValueConf  *ValueInsightConfig  `json:"value,omitempty"`
	FunnelConf *FunnelInsightConfig `json:"funnel,omitempty"`
}

type TimeBucket string

const (
	Hourly  TimeBucket = "Hourly"
	Daily   TimeBucket = "Daily"
	Weekly  TimeBucket = "Weekly"
	Monthly TimeBucket = "Monthly"
)

func (c *InsightConfig) Scan(src any) error {
	if src == nil {
		return nil
	}

	var data []byte
	switch v := src.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("invalid type for InsightConfig %T", src)
	}

	return json.Unmarshal(data, c)
}

func (c InsightConfig) Value() (driver.Value, error) {
	return json.Marshal(c)
}

// Apply merges fields from an InsightInput into the current Insight.
func (i *Insight) Apply(input InsightInput) {
	if input.Name != "" {
		i.Name = input.Name
	}
	if input.Type != "" {
		i.Type = input.Type
	}
	if input.Favorite != nil {
		i.Favorite = input.Favorite
	}
	if input.Config != nil {
		i.Config = input.Config
	}
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

type InsightQuery struct {
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
