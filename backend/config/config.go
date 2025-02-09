package config

import (
	"analytics/log"
	"fmt"
	"os"
	"strconv"
)

func Load() *Config {
	return &Config{
		Port: eInt("PORT", 3000),
	}
}

func e(k string, d string) string {
	val := os.Getenv(k)
	if val == "" {
		return d
	}
	return val
}

func eInt(k string, d int) int {
	val, err := strconv.Atoi(os.Getenv(k))
	if err != nil {
		log.Warn(fmt.Sprintf("could not parse %s as int: %s", k, err), err.Error())
		return d
	}
	return val
}

type Config struct {
	Port int
}
