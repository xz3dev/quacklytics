package config

import (
	"analytics/util"
	_ "embed"
	"github.com/gurkankaymak/hocon"
	"os"
	"strings"
)

//go:embed default.conf
var defaultConfig string

var Config *appConfig

func Load() *appConfig {

	if _, err := os.Stat("application.conf"); os.IsNotExist(err) {
		file, createErr := os.Create("application.conf")
		if createErr != nil {
			panic(createErr)
		}
		defer file.Close()

		secret, err := util.GenerateRandomString(32)
		if err != nil {
			panic(err)
		}

		defaultConfig = strings.ReplaceAll(defaultConfig, "replace-me-with-random-string", secret)
		_, writeErr := file.WriteString(defaultConfig)
		if writeErr != nil {
			panic(writeErr)
		}
	}
	conf, err := hocon.ParseResource("application.conf")
	if err != nil {
		panic(err)
	}
	Config = &appConfig{
		Port:          conf.GetInt("app.port"),
		ServeFrontend: conf.GetBoolean("app.serve_frontend"),
		Paths: paths{
			Parquet:  getString(conf, "paths.parquet"),
			Database: getString(conf, "paths.database"),
		},
		Database: database{
			ProjectPrefix:   getString(conf, "database.project_prefix"),
			AnalyticsPrefix: getString(conf, "database.analytics_prefix"),
		},
		Auth: auth{
			Secret:       getString(conf, "auth.secret"),
			SecureCookie: conf.GetBoolean("auth.secure_cookie"),
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

type appConfig struct {
	Port          int
	ServeFrontend bool
	Paths         paths
	Database      database
	Auth          auth
}

type paths struct {
	Parquet  string
	Database string
}

type database struct {
	ProjectPrefix   string
	AnalyticsPrefix string
}

type auth struct {
	Secret       string
	SecureCookie bool
}
