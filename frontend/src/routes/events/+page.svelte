<script lang="ts">
    import { ParquetManager, pqManager } from '$lib/parquet-manager'
    import type { AnalyticsEvent } from '$lib/event'
    import EventList from '$lib/components/EventList.svelte'
    import { dbManager } from '$lib/globals'

    let searchTerm = 'select * from events order by timestamp desc limit 10;'

    let events: AnalyticsEvent[] = []

    const runQuery = async () => {
        events = await dbManager.runEventsQuery(searchTerm, []) ?? []
    }
</script>

<div class="flex flex-col gap-2">
  <div class="flex items-start">
    <h1 class="text-3xl font-bold flex-1">Events</h1>
    <button
      class="btn btn-primary self-start"
      on:click={() => pqManager.downloadLast12Weeks()}
    >
      Download last 12 weeks
    </button>
  </div>


  <div>
    <textarea bind:value={searchTerm} class="w-full min-h-20" />
    <button class="btn btn-block" on:click={runQuery}>Search</button>
  </div>

  <EventList {events} />
</div>
