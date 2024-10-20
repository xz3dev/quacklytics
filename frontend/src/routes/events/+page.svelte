<script lang="ts">
    import { ParquetManager, pqManager } from '$lib/parquet-manager'
    import type { AnalyticsEvent } from '$lib/event'
    import EventList from '$lib/components/EventList.svelte'
    import { dbManager } from '$lib/globals'
    import { Button } from '$lib/components/ui/button'

    let searchTerm = 'select * from events order by timestamp desc limit 10;'

    let events: AnalyticsEvent[] = []

    const runQuery = async () => {
        events = await dbManager.runEventsQuery(searchTerm, []) ?? []
    }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-start">
    <h1 class="text-3xl font-bold flex-1">Events</h1>
    <Button
      on:click={() => pqManager.downloadLast12Weeks()}
      variant="outline"
    >
      Download last 12 weeks
    </Button>
  </div>


  <div>
    <textarea bind:value={searchTerm} class="w-full min-h-20" />
    <Button 
      class="w-full"
      on:click={runQuery}
    >Search</Button>
  </div>

  <EventList {events} />
</div>
