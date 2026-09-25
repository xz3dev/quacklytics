package tzinit

import (
	"os"
	"time"
)

func init() {
	os.Setenv("TZ", "Etc/UTC")
	time.Local = time.UTC
	println("TZ set to UTC")
}
