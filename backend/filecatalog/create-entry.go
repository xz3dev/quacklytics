package filecatalog

import (
	"analytics/model"
	"analytics/projects"
	"analytics/util"
	"gorm.io/gorm"
)

func CreateEntry(
	projectId string,
	db *gorm.DB,
	segment DataSegment,
) error {
	filepath := projects.TmpDir + "/" + projectId + "/" + ParquetDir + "/" + segment.Filename
	checksum, err := util.CalculateFileChecksum(filepath)
	if err != nil {
		return err
	}

	entry := model.FileCatalogEntry{
		Name:       segment.Filename,
		Start:      &segment.StartDate,
		End:        &segment.EndDate,
		ValidUntil: segment.ValidUntil,
		Checksum:   checksum,
	}

	return db.Create(&entry).Error
}
