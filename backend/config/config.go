package config

import (
	_ "embed"
	"github.com/gurkankaymak/hocon"
	"os"
)

//go:embed default.conf
var defaultConfig string

var Config *AppConfig

func Load() *AppConfig {

	if _, err := os.Stat("application.conf"); os.IsNotExist(err) {
		file, createErr := os.Create("application.conf")
		if createErr != nil {
			panic(createErr)
		}
		defer file.Close()

		_, writeErr := file.WriteString(defaultConfig)
		if writeErr != nil {
			panic(writeErr)
		}
	}
	conf, err := hocon.ParseResource("application.conf")
	if err != nil {
		panic(err)
	}
	Config = &AppConfig{
		Port:          conf.GetInt("app.port"),
		ServeFrontend: conf.GetBoolean("app.serve_frontend"),
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
	Port          int
	ServeFrontend bool
	Paths         Paths
	Database      Database
}

type Paths struct {
	Parquet  string
	Database string
}

type Database struct {
	ProjectPrefix   string
	AnalyticsPrefix string
}
