package eventprocessor

type EventVerifier struct{}

func (v *EventVerifier) Process(ctx *PipelineContext) error {
	// TODO: remove?
	//for _, event := range ctx.OutputEvents {
	//if event.EventId.PersonId == uuid.Nil {
	//	return fmt.Errorf("new event %s has no personId", event.Timestamp.String())
	//}
	//}
	return nil
}
