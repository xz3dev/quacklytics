package config

import (
	"github.com/gurkankaymak/hocon"
)

func Load() *AppConfig {
	conf, err := hocon.ParseResource("application.conf")
	if err != nil {
		panic(err)
	}
	return &AppConfig{
		Port: conf.GetInt("app.port"),
	}
}

type AppConfig struct {
	Port int
}
