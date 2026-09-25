//go:build ingestionpoc

package log

import "go.uber.org/zap"

// SilenceIngestionPoC removes console logging from the isolated benchmark only.
func SilenceIngestionPoC() {
	Logger = zap.NewNop()
	sugar = Logger.Sugar()
}
