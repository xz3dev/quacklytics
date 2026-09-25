package dashboards

import (
	"analytics/domain/insights"
	"errors"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestCreateDashboardFromTemplateCreatesWebAnalyticsDashboard(t *testing.T) {
	db := setupDefaultDashboardTestDB(t)
	home := true

	dashboard, err := CreateDashboardFromTemplate(db, WebAnalyticsDashboardTemplate, TemplateDashboardInput{Home: &home})
	if err != nil {
		t.Fatalf("CreateDashboardFromTemplate returned error: %v", err)
	}
	if dashboard == nil {
		t.Fatal("CreateDashboardFromTemplate returned nil dashboard")
	}
	if dashboard.Name != DefaultDashboardName {
		t.Fatalf("expected dashboard name %q, got %q", DefaultDashboardName, dashboard.Name)
	}
	if !dashboard.Home {
		t.Fatal("expected web analytics dashboard to be the home dashboard")
	}

	expectedNames := []string{
		"Pageviews",
		"Clicks",
		"Unique sessions",
		"Mobile activity",
		"Pageviews and clicks over time",
		"Top pages",
		"Device mix",
		"Browser mix",
		"Top referrers",
		"Visitor retention",
		"Common page journeys",
	}
	expectedTypes := []insights.InsightType{
		insights.Value,
		insights.Value,
		insights.Value,
		insights.Value,
		insights.Trend,
		insights.Breakdown,
		insights.Breakdown,
		insights.Breakdown,
		insights.Breakdown,
		insights.Retention,
		insights.Path,
	}
	assertTemplateInsights(t, db, dashboard, expectedNames, expectedTypes)

	topPages := dashboard.Insights[5]
	if topPages.Config == nil || topPages.Config.BreakdownConf == nil {
		t.Fatal("expected Top pages to have breakdown config")
	}
	if topPages.Config.BreakdownConf.Dimension.Name != "$.pagePath" {
		t.Fatalf("expected Top pages dimension $.pagePath, got %q", topPages.Config.BreakdownConf.Dimension.Name)
	}

	retention := dashboard.Insights[9]
	if retention.Config == nil || retention.Config.RetentionConf == nil {
		t.Fatal("expected Visitor retention to have retention config")
	}
	if retention.Config.RetentionConf.CohortBucket != insights.Daily {
		t.Fatalf("expected daily retention cohorts, got %q", retention.Config.RetentionConf.CohortBucket)
	}
	if len(retention.Config.RetentionConf.ActivationQuery.Filters) != 1 ||
		retention.Config.RetentionConf.ActivationQuery.Filters[0].Value != "$pageview" {
		t.Fatalf("expected retention activation to default to $pageview, got %+v", retention.Config.RetentionConf.ActivationQuery.Filters)
	}

	path := dashboard.Insights[10]
	if path.Config == nil || path.Config.PathConf == nil {
		t.Fatal("expected Common page journeys to have path config")
	}
	if path.Config.PathConf.StepField.Name != "$.pagePath" {
		t.Fatalf("expected page journey step field $.pagePath, got %q", path.Config.PathConf.StepField.Name)
	}
}

func TestCreateDashboardFromTemplateCreatesProductAnalyticsDashboard(t *testing.T) {
	db := setupDefaultDashboardTestDB(t)
	name := "App analytics"

	dashboard, err := CreateDashboardFromTemplate(db, ProductAnalyticsDashboardTemplate, TemplateDashboardInput{Name: &name})
	if err != nil {
		t.Fatalf("CreateDashboardFromTemplate returned error: %v", err)
	}
	if dashboard.Name != name {
		t.Fatalf("expected custom dashboard name %q, got %q", name, dashboard.Name)
	}
	if dashboard.Home {
		t.Fatal("expected product template dashboard not to be home without explicit home input")
	}

	expectedNames := []string{
		"Active users",
		"New users",
		"Core events over time",
		"Activation funnel",
		"Feature adoption",
		"User retention",
		"Common app journeys",
	}
	expectedTypes := []insights.InsightType{
		insights.Value,
		insights.Value,
		insights.Trend,
		insights.Funnel,
		insights.Breakdown,
		insights.Retention,
		insights.Path,
	}
	assertTemplateInsights(t, db, dashboard, expectedNames, expectedTypes)

	featureAdoption := dashboard.Insights[4]
	if featureAdoption.Config == nil || featureAdoption.Config.BreakdownConf == nil {
		t.Fatal("expected Feature adoption to have breakdown config")
	}
	if featureAdoption.Config.BreakdownConf.Dimension.Name != "event_type" {
		t.Fatalf("expected Feature adoption dimension event_type, got %q", featureAdoption.Config.BreakdownConf.Dimension.Name)
	}

	appJourneys := dashboard.Insights[6]
	if appJourneys.Config == nil || appJourneys.Config.PathConf == nil {
		t.Fatal("expected Common app journeys to have path config")
	}
	if appJourneys.Config.PathConf.StepField.Name != "event_type" {
		t.Fatalf("expected app journey step field event_type, got %q", appJourneys.Config.PathConf.StepField.Name)
	}
}

func TestApplyTemplateToEmptyDashboard(t *testing.T) {
	db := setupDefaultDashboardTestDB(t)
	dashboard := Dashboard{DashboardInput: DashboardInput{Name: "My empty dashboard"}}
	dashboard.ApplyInput(dashboard.DashboardInput)
	if err := db.Create(&dashboard).Error; err != nil {
		t.Fatalf("failed to create empty dashboard: %v", err)
	}

	updated, err := ApplyTemplateToDashboard(db, dashboard.ID, ProductAnalyticsDashboardTemplate)
	if err != nil {
		t.Fatalf("ApplyTemplateToDashboard returned error: %v", err)
	}
	if updated.Name != "My empty dashboard" {
		t.Fatalf("expected template application to preserve dashboard name, got %q", updated.Name)
	}
	if len(updated.Insights) != 7 {
		t.Fatalf("expected 7 product template insights, got %d", len(updated.Insights))
	}
	assertDashboardInsightSort(t, db, len(updated.Insights))
}

func TestApplyTemplateToDashboardWithInsightsReturnsConflict(t *testing.T) {
	db := setupDefaultDashboardTestDB(t)
	dashboard, err := CreateDashboardFromTemplate(db, WebAnalyticsDashboardTemplate, TemplateDashboardInput{})
	if err != nil {
		t.Fatalf("failed to create dashboard: %v", err)
	}

	_, err = ApplyTemplateToDashboard(db, dashboard.ID, ProductAnalyticsDashboardTemplate)
	if !errors.Is(err, ErrDashboardNotEmpty) {
		t.Fatalf("expected ErrDashboardNotEmpty, got %v", err)
	}

	var links []DashboardInsight
	if err := db.Find(&links).Error; err != nil {
		t.Fatalf("failed to load dashboard links: %v", err)
	}
	if len(links) != len(dashboard.Insights) {
		t.Fatalf("expected conflict to leave %d links unchanged, got %d", len(dashboard.Insights), len(links))
	}
}

func TestRestoreDefaultDashboardRequiresEmptyDashboardTable(t *testing.T) {
	db := setupDefaultDashboardTestDB(t)

	if _, err := CreateDashboardFromTemplate(db, WebAnalyticsDashboardTemplate, TemplateDashboardInput{}); err != nil {
		t.Fatalf("CreateDashboardFromTemplate returned error: %v", err)
	}

	_, err := RestoreDefaultDashboard(db)
	if !errors.Is(err, ErrDashboardsExist) {
		t.Fatalf("expected ErrDashboardsExist, got %v", err)
	}
}

func TestRestoreDefaultDashboardUsesWebAnalyticsTemplate(t *testing.T) {
	db := setupDefaultDashboardTestDB(t)

	dashboard, err := RestoreDefaultDashboard(db)
	if err != nil {
		t.Fatalf("RestoreDefaultDashboard returned error: %v", err)
	}
	if dashboard.Name != DefaultDashboardName {
		t.Fatalf("expected default dashboard name %q, got %q", DefaultDashboardName, dashboard.Name)
	}
	if len(dashboard.Insights) != 11 {
		t.Fatalf("expected default web analytics insight count 11, got %d", len(dashboard.Insights))
	}
	if dashboard.Insights[5].Type != insights.Breakdown {
		t.Fatalf("expected default dashboard to include breakdown insights, got %q", dashboard.Insights[5].Type)
	}
}

func setupDefaultDashboardTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	if err := db.AutoMigrate(&Dashboard{}, &DashboardInsight{}, &insights.Insight{}); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	return db
}

func assertTemplateInsights(
	t *testing.T,
	db *gorm.DB,
	dashboard *Dashboard,
	expectedNames []string,
	expectedTypes []insights.InsightType,
) {
	t.Helper()

	if len(dashboard.Insights) != len(expectedNames) {
		t.Fatalf("expected %d insights, got %d", len(expectedNames), len(dashboard.Insights))
	}

	for index, insight := range dashboard.Insights {
		if insight.Name != expectedNames[index] {
			t.Fatalf("expected insight %d name %q, got %q", index, expectedNames[index], insight.Name)
		}
		if insight.Type != expectedTypes[index] {
			t.Fatalf("expected insight %q type %q, got %q", insight.Name, expectedTypes[index], insight.Type)
		}
	}

	assertDashboardInsightSort(t, db, len(dashboard.Insights))
}

func assertDashboardInsightSort(t *testing.T, db *gorm.DB, expectedLinks int) {
	t.Helper()

	var links []DashboardInsight
	if err := db.Order("sort ASC").Find(&links).Error; err != nil {
		t.Fatalf("failed to load dashboard insights: %v", err)
	}
	if len(links) != expectedLinks {
		t.Fatalf("expected %d dashboard insight links, got %d", expectedLinks, len(links))
	}
	for index, link := range links {
		if link.Sort != index {
			t.Fatalf("expected link sort %d, got %d", index, link.Sort)
		}
	}
}
