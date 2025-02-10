package config

import (
	"github.com/gurkankaymak/hocon"
)

var Config *AppConfig

func Load() *AppConfig {
	conf, err := hocon.ParseResource("application.conf")
	if err != nil {
		panic(err)
	}
	Config = &AppConfig{
		Port: conf.GetInt("app.port"),
		Paths: Paths{
			Parquet:  getString(conf, "paths.parquet"),
			Database: getString(conf, "paths.database"),
		},
		Database: Database{
			ProjectPrefix:   getString(conf, "database.project_prefix"),
			AnalyticsPrefix: getString(conf, "database.analytics_prefix"),
		},
	}
	return Config
}

func getString(c *hocon.Config, key string) string {
	val := c.GetString(key)
	if val[0:1] == `"` && val[len(val)-1:] == `"` {
		val = val[1 : len(val)-1]
	}
	return val
}

type AppConfig struct {
	Port     int
	Paths    Paths
	Database Database
}

type Paths struct {
	Parquet  string
	Database string
}

type Database struct {
	ProjectPrefix   string
	AnalyticsPrefix string
}
