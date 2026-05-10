package dashboards

import (
	"analytics/domain/insights"
	"errors"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestEnsureDefaultDashboardCreatesWebAnalyticsDashboard(t *testing.T) {
	db := setupDefaultDashboardTestDB(t)

	dashboard, err := EnsureDefaultDashboard(db)
	if err != nil {
		t.Fatalf("EnsureDefaultDashboard returned error: %v", err)
	}
	if dashboard == nil {
		t.Fatal("EnsureDefaultDashboard returned nil dashboard")
	}
	if dashboard.Name != DefaultDashboardName {
		t.Fatalf("expected dashboard name %q, got %q", DefaultDashboardName, dashboard.Name)
	}
	if !dashboard.Home {
		t.Fatal("expected default dashboard to be the home dashboard")
	}
	if len(dashboard.Insights) != 5 {
		t.Fatalf("expected 5 default insights, got %d", len(dashboard.Insights))
	}

	var links []DashboardInsight
	if err := db.Order("sort ASC").Find(&links).Error; err != nil {
		t.Fatalf("failed to load dashboard insights: %v", err)
	}
	if len(links) != len(dashboard.Insights) {
		t.Fatalf("expected %d dashboard insight links, got %d", len(dashboard.Insights), len(links))
	}
	for index, link := range links {
		if link.Sort != index {
			t.Fatalf("expected link sort %d, got %d", index, link.Sort)
		}
	}

	assertDefaultInsight(t, dashboard.Insights[0], "Pageviews", insights.Value, "$pageview")
	assertDefaultInsight(t, dashboard.Insights[1], "Clicks", insights.Value, "$click")
	assertDefaultInsight(t, dashboard.Insights[4], "Pageviews and clicks over time", insights.Trend, "")
}

func TestRestoreDefaultDashboardRequiresEmptyDashboardTable(t *testing.T) {
	db := setupDefaultDashboardTestDB(t)

	if _, err := EnsureDefaultDashboard(db); err != nil {
		t.Fatalf("EnsureDefaultDashboard returned error: %v", err)
	}

	_, err := RestoreDefaultDashboard(db)
	if !errors.Is(err, ErrDashboardsExist) {
		t.Fatalf("expected ErrDashboardsExist, got %v", err)
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

func assertDefaultInsight(
	t *testing.T,
	insight insights.Insight,
	name string,
	insightType insights.InsightType,
	filterEventType string,
) {
	t.Helper()

	if insight.Name != name {
		t.Fatalf("expected insight name %q, got %q", name, insight.Name)
	}
	if insight.Type != insightType {
		t.Fatalf("expected insight type %q, got %q", insightType, insight.Type)
	}
	if filterEventType == "" {
		return
	}
	if insight.Config == nil || insight.Config.ValueConf == nil || insight.Config.ValueConf.Series == nil {
		t.Fatalf("expected value insight %q to have value config", name)
	}
	filters := insight.Config.ValueConf.Series.Query.Filters
	if len(filters) != 1 {
		t.Fatalf("expected insight %q to have 1 filter, got %d", name, len(filters))
	}
	if filters[0].Field.Name != "event_type" || filters[0].Value != filterEventType {
		t.Fatalf("expected insight %q to filter event_type=%q, got %+v", name, filterEventType, filters[0])
	}
}
