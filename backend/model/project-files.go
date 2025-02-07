package model

type ProjectFiles struct {
	ID              string `json:"id"`
	DbFile          string `json:"dbFile"`
	AnalyticsDbFile string `json:"analyticsDbFile"`
}
