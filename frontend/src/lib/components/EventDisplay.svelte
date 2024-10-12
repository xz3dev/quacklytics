<script lang="ts">
    import type { AnalyticsEvent } from '$lib/event'

    export let event: AnalyticsEvent
    export let classes: string = ''
</script>

<div class="{classes}">
  {event.id} - {event.eventType} - {event.timestamp} - {event.userId}
</div>
