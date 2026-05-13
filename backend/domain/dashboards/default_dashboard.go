package dashboards

import (
	"analytics/domain/insights"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

type DashboardTemplate string

const (
	WebAnalyticsDashboardTemplate     DashboardTemplate = "web_analytics"
	ProductAnalyticsDashboardTemplate DashboardTemplate = "product_analytics"
)

const DefaultDashboardName = "Web Analytics Overview"
const ProductAnalyticsDashboardName = "Product Analytics Overview"

var ErrDashboardsExist = errors.New("default dashboard can only be restored when no dashboards exist")
var ErrDashboardNotEmpty = errors.New("dashboard template can only be applied to an empty dashboard")
var ErrUnknownDashboardTemplate = errors.New("unknown dashboard template")

type TemplateDashboardInput struct {
	Name *string `json:"name,omitempty"`
	Home *bool   `json:"home,omitempty"`
}

func EnsureDefaultDashboard(db *gorm.DB) (*Dashboard, error) {
	var count int64
	if err := db.Model(&Dashboard{}).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("failed to count dashboards: %w", err)
	}
	if count > 0 {
		return nil, nil
	}

	home := true
	return CreateDashboardFromTemplate(db, WebAnalyticsDashboardTemplate, TemplateDashboardInput{Home: &home})
}

func RestoreDefaultDashboard(db *gorm.DB) (*Dashboard, error) {
	var count int64
	if err := db.Model(&Dashboard{}).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("failed to count dashboards: %w", err)
	}
	if count > 0 {
		return nil, ErrDashboardsExist
	}

	home := true
	return CreateDashboardFromTemplate(db, WebAnalyticsDashboardTemplate, TemplateDashboardInput{Home: &home})
}

func CreateDefaultDashboard(db *gorm.DB) (*Dashboard, error) {
	home := true
	return CreateDashboardFromTemplate(db, WebAnalyticsDashboardTemplate, TemplateDashboardInput{Home: &home})
}

func CreateDashboardFromTemplate(db *gorm.DB, template DashboardTemplate, input TemplateDashboardInput) (*Dashboard, error) {
	templateSpec, err := buildDashboardTemplate(template)
	if err != nil {
		return nil, err
	}

	name := templateSpec.Name
	if input.Name != nil && *input.Name != "" {
		name = *input.Name
	}

	home := false
	if input.Home != nil {
		home = *input.Home
	}

	dashboard := Dashboard{
		Name: name,
		DashboardInput: DashboardInput{
			Name:     name,
			Favorite: home,
		},
		Home: home,
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		if home {
			if err := tx.Model(&Dashboard{}).Where("home = true").Update("home", false).Error; err != nil {
				return fmt.Errorf("failed to clear existing home dashboard: %w", err)
			}
		}

		if err := createTemplateInsights(tx, &dashboard, templateSpec.Insights); err != nil {
			return err
		}

		return nil
	}); err != nil {
		return nil, err
	}

	dashboard.Insights = templateSpec.Insights
	return &dashboard, nil
}

func ApplyTemplateToDashboard(db *gorm.DB, dashboardID uint, template DashboardTemplate) (*Dashboard, error) {
	templateSpec, err := buildDashboardTemplate(template)
	if err != nil {
		return nil, err
	}

	var dashboard Dashboard
	if err := db.First(&dashboard, dashboardID).Error; err != nil {
		return nil, err
	}

	var linkedInsights int64
	if err := db.Model(&DashboardInsight{}).Where("dashboard_id = ?", dashboardID).Count(&linkedInsights).Error; err != nil {
		return nil, fmt.Errorf("failed to count dashboard insights: %w", err)
	}
	if linkedInsights > 0 {
		return nil, ErrDashboardNotEmpty
	}

	if err := db.Transaction(func(tx *gorm.DB) error {
		return createTemplateInsights(tx, &dashboard, templateSpec.Insights)
	}); err != nil {
		return nil, err
	}

	dashboard.Insights = templateSpec.Insights
	return &dashboard, nil
}

type dashboardTemplateSpec struct {
	Name     string
	Insights []insights.Insight
}

func buildDashboardTemplate(template DashboardTemplate) (dashboardTemplateSpec, error) {
	switch template {
	case WebAnalyticsDashboardTemplate:
		return dashboardTemplateSpec{
			Name:     DefaultDashboardName,
			Insights: webAnalyticsInsights(),
		}, nil
	case ProductAnalyticsDashboardTemplate:
		return dashboardTemplateSpec{
			Name:     ProductAnalyticsDashboardName,
			Insights: productAnalyticsInsights(),
		}, nil
	default:
		return dashboardTemplateSpec{}, ErrUnknownDashboardTemplate
	}
}

func createTemplateInsights(tx *gorm.DB, dashboard *Dashboard, templateInsights []insights.Insight) error {
	if err := tx.Create(&templateInsights).Error; err != nil {
		return fmt.Errorf("failed to create template insights: %w", err)
	}

	if dashboard.ID == 0 {
		if err := tx.Create(dashboard).Error; err != nil {
			return fmt.Errorf("failed to create template dashboard: %w", err)
		}
	}

	for sort, insight := range templateInsights {
		link := DashboardInsight{
			DashboardID: dashboard.ID,
			InsightID:   insight.ID,
			Sort:        sort,
		}
		if err := tx.Create(&link).Error; err != nil {
			return fmt.Errorf("failed to add template insight to dashboard: %w", err)
		}
	}

	return nil
}

func webAnalyticsInsights() []insights.Insight {
	notFavorite := false

	return []insights.Insight{
		newValueInsight("Pageviews", countEventsQuery(eventTypeFilter("$pageview")), notFavorite),
		newValueInsight("Clicks", countEventsQuery(eventTypeFilter("$click")), notFavorite),
		newValueInsight("Unique sessions", countDistinctQuery("session_id", nil), notFavorite),
		newValueInsight("Mobile activity", countEventsQuery(insights.FieldFilter{
			Field:    propertyField("deviceType"),
			Operator: insights.OperatorEquals,
			Value:    "mobile",
		}), notFavorite),
		newTrendInsight("Pageviews and clicks over time", []insights.TrendSeries{
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
		}, notFavorite),
		newBreakdownInsight("Top pages", propertyField("pagePath"), nil, notFavorite),
		newBreakdownInsight("Device mix", propertyField("deviceType"), nil, notFavorite),
		newBreakdownInsight("Browser mix", propertyField("browser"), nil, notFavorite),
		newBreakdownInsight("Top referrers", propertyField("referrer"), nil, notFavorite),
		newRetentionInsight("Visitor retention", insights.Daily, countEventsQuery(eventTypeFilter("$pageview")), insights.InsightQuery{}, 14, notFavorite),
		newPathInsight("Common page journeys", countEventsQuery(eventTypeFilter("$pageview")), propertyField("pagePath"), "forward", notFavorite),
	}
}

func productAnalyticsInsights() []insights.Insight {
	notFavorite := false

	entryQuery := countEventsQuery(eventTypeFilter("$pageview"))
	anyEventQuery := countEventsQuery()

	return []insights.Insight{
		newValueInsight("Active users", countDistinctActorQuery(nil), notFavorite),
		newValueInsight("New users", countDistinctQuery("person_id", nil), notFavorite),
		newTrendInsight("Core events over time", []insights.TrendSeries{
			{
				Name:          "Events",
				Visualisation: "line",
				Query:         countEventsQuery(),
			},
		}, notFavorite),
		newFunnelInsight("Activation funnel", []insights.FunnelStep{
			{
				Id:    "entry",
				Name:  "Entry event",
				Order: 0,
				Query: entryQuery,
			},
			{
				Id:    "return",
				Name:  "Any later event",
				Order: 1,
				Query: anyEventQuery,
			},
		}, notFavorite),
		newBreakdownInsight("Feature adoption", eventField("event_type"), nil, notFavorite),
		newRetentionInsight("User retention", insights.Daily, entryQuery, insights.InsightQuery{}, 14, notFavorite),
		newPathInsight("Common app journeys", anyEventQuery, eventField("event_type"), "forward", notFavorite),
	}
}

func newValueInsight(name string, query insights.InsightQuery, favorite bool) insights.Insight {
	return insights.Insight{
		InsightInput: insights.InsightInput{
			Name:     name,
			Type:     insights.Value,
			Favorite: &favorite,
			Config:   valueConfig(query),
		},
	}
}

func newTrendInsight(name string, series []insights.TrendSeries, favorite bool) insights.Insight {
	return insights.Insight{
		InsightInput: insights.InsightInput{
			Name:     name,
			Type:     insights.Trend,
			Favorite: &favorite,
			Config: &insights.InsightConfig{
				TrendConf: &insights.TrendInsightConfig{
					Duration:   "P30D",
					TimeBucket: insights.Daily,
					Series:     &series,
				},
			},
		},
	}
}

func newFunnelInsight(name string, steps []insights.FunnelStep, favorite bool) insights.Insight {
	return insights.Insight{
		InsightInput: insights.InsightInput{
			Name:     name,
			Type:     insights.Funnel,
			Favorite: &favorite,
			Config: &insights.InsightConfig{
				FunnelConf: &insights.FunnelInsightConfig{
					Duration: "P30D",
					Steps:    steps,
				},
			},
		},
	}
}

func newBreakdownInsight(name string, dimension insights.Field, filters []insights.FieldFilter, favorite bool) insights.Insight {
	limit := 10
	return insights.Insight{
		InsightInput: insights.InsightInput{
			Name:     name,
			Type:     insights.Breakdown,
			Favorite: &favorite,
			Config: &insights.InsightConfig{
				BreakdownConf: &insights.BreakdownInsightConfig{
					Duration:  "P30D",
					Dimension: dimension,
					Aggregation: insights.Aggregation{
						Function: insights.AggregationCount,
						Field:    eventField("id"),
						Alias:    "result_value",
					},
					Filters: filters,
					Limit:   limit,
				},
			},
		},
	}
}

func newRetentionInsight(
	name string,
	cohortBucket insights.TimeBucket,
	activationQuery insights.InsightQuery,
	returnQuery insights.InsightQuery,
	maxPeriods int,
	favorite bool,
) insights.Insight {
	return insights.Insight{
		InsightInput: insights.InsightInput{
			Name:     name,
			Type:     insights.Retention,
			Favorite: &favorite,
			Config: &insights.InsightConfig{
				RetentionConf: &insights.RetentionInsightConfig{
					Duration:        "P30D",
					CohortBucket:    cohortBucket,
					ActivationQuery: activationQuery,
					ReturnQuery:     returnQuery,
					MaxPeriods:      maxPeriods,
				},
			},
		},
	}
}

func newPathInsight(
	name string,
	anchorQuery insights.InsightQuery,
	stepField insights.Field,
	direction string,
	favorite bool,
) insights.Insight {
	return insights.Insight{
		InsightInput: insights.InsightInput{
			Name:     name,
			Type:     insights.Path,
			Favorite: &favorite,
			Config: &insights.InsightConfig{
				PathConf: &insights.PathInsightConfig{
					Duration:    "P30D",
					AnchorQuery: anchorQuery,
					Direction:   direction,
					StepField:   stepField,
					MaxSteps:    5,
					Limit:       10,
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

func countDistinctActorQuery(filters []insights.FieldFilter) insights.InsightQuery {
	query := countEventsQuery(filters...)
	query.Aggregations[0].Field = insights.Field{
		Name:     `COALESCE(person_id, session_id)`,
		DataType: "string",
	}
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
