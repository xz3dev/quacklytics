package filecatalog

import (
	"time"
)

type exportParams struct {
	Start      *time.Time
	End        *time.Time
	ValidUntil *time.Time
}

func determineValidUntil(params *exportParams) {
	if params.ValidUntil != nil {
		return
	}

}
