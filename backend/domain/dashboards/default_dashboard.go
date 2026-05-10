package dashboards

import (
	"analytics/domain/insights"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

var ErrDashboardsExist = errors.New("default dashboard can only be restored when no dashboards exist")

const DefaultDashboardName = "Web Analytics Overview"

func EnsureDefaultDashboard(db *gorm.DB) (*Dashboard, error) {
	var count int64
	if err := db.Model(&Dashboard{}).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("failed to count dashboards: %w", err)
	}
	if count > 0 {
		return nil, nil
	}

	return CreateDefaultDashboard(db)
}

func RestoreDefaultDashboard(db *gorm.DB) (*Dashboard, error) {
	var count int64
	if err := db.Model(&Dashboard{}).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("failed to count dashboards: %w", err)
	}
	if count > 0 {
		return nil, ErrDashboardsExist
	}

	return CreateDefaultDashboard(db)
}

func CreateDefaultDashboard(db *gorm.DB) (*Dashboard, error) {
	defaultInsights := defaultDashboardInsights()
	dashboard := Dashboard{
		Name: DefaultDashboardName,
		DashboardInput: DashboardInput{
			Name:     DefaultDashboardName,
			Favorite: true,
		},
		Home: true,
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&defaultInsights).Error; err != nil {
			return fmt.Errorf("failed to create default insights: %w", err)
		}

		if err := tx.Create(&dashboard).Error; err != nil {
			return fmt.Errorf("failed to create default dashboard: %w", err)
		}

		for sort, insight := range defaultInsights {
			link := DashboardInsight{
				DashboardID: dashboard.ID,
				InsightID:   insight.ID,
				Sort:        sort,
			}
			if err := tx.Create(&link).Error; err != nil {
				return fmt.Errorf("failed to add default insight to dashboard: %w", err)
			}
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	dashboard.Insights = defaultInsights
	return &dashboard, nil
}

func defaultDashboardInsights() []insights.Insight {
	notFavorite := false

	return []insights.Insight{
		{
			InsightInput: insights.InsightInput{
				Name:     "Pageviews",
				Type:     insights.Value,
				Favorite: &notFavorite,
				Config:   valueConfig(countEventsQuery(eventTypeFilter("$pageview"))),
			},
		},
		{
			InsightInput: insights.InsightInput{
				Name:     "Clicks",
				Type:     insights.Value,
				Favorite: &notFavorite,
				Config:   valueConfig(countEventsQuery(eventTypeFilter("$click"))),
			},
		},
		{
			InsightInput: insights.InsightInput{
				Name:     "Unique sessions",
				Type:     insights.Value,
				Favorite: &notFavorite,
				Config:   valueConfig(countDistinctQuery("session_id", nil)),
			},
		},
		{
			InsightInput: insights.InsightInput{
				Name:     "Mobile activity",
				Type:     insights.Value,
				Favorite: &notFavorite,
				Config: valueConfig(countEventsQuery(insights.FieldFilter{
					Field:    propertyField("deviceType"),
					Operator: insights.OperatorEquals,
					Value:    "mobile",
				})),
			},
		},
		{
			InsightInput: insights.InsightInput{
				Name:     "Pageviews and clicks over time",
				Type:     insights.Trend,
				Favorite: &notFavorite,
				Config: &insights.InsightConfig{
					TrendConf: &insights.TrendInsightConfig{
						Duration:   "P30D",
						TimeBucket: insights.Daily,
						Series: &[]insights.TrendSeries{
							{
								Name:          "Pageviews",
								Visualisation: "line",
								Query:         countEventsQuery(eventTypeFilter("$pageview")),
							},
							{
								Name:          "Clicks",
								Visualisation: "bar",
								Query:         countEventsQuery(eventTypeFilter("$click")),
							},
						},
					},
				},
			},
		},
	}
}

func valueConfig(query insights.InsightQuery) *insights.InsightConfig {
	return &insights.InsightConfig{
		ValueConf: &insights.ValueInsightConfig{
			Duration: "P30D",
			Series: &insights.TrendSeries{
				Query: query,
			},
		},
	}
}

func countEventsQuery(filters ...insights.FieldFilter) insights.InsightQuery {
	return insights.InsightQuery{
		Filters: filters,
		Aggregations: []insights.Aggregation{
			{
				Function: insights.AggregationCount,
				Field:    eventField("id"),
				Alias:    "result_value",
			},
		},
	}
}

func countDistinctQuery(fieldName string, filters []insights.FieldFilter) insights.InsightQuery {
	query := countEventsQuery(filters...)
	query.Aggregations[0].Field = eventField(fieldName)
	query.Aggregations[0].Distinct = true
	return query
}

func eventTypeFilter(eventType string) insights.FieldFilter {
	return insights.FieldFilter{
		Field:    eventField("event_type"),
		Operator: insights.OperatorEquals,
		Value:    eventType,
	}
}

func eventField(name string) insights.Field {
	return insights.Field{
		Name:     name,
		DataType: "string",
	}
}

func propertyField(name string) insights.Field {
	return insights.Field{
		Name:     "$." + name,
		DataType: "string",
	}
}
