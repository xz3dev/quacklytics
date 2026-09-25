package tzinit

import (
	"github.com/zeebo/assert"
	"testing"
	"time"
)

func TestDefaultTZ(t *testing.T) {
	testTime := time.Now()
	assert.Equal(t, testTime.Location(), time.UTC)
}
