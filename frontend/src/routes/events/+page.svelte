<script lang="ts">
    import { ParquetManager } from '$lib/parquet-manager'
    import { dbManager } from '$lib/duck-db-manager'
    import type { AnalyticsEvent } from '$lib/event'
    import EventDisplay from '$lib/components/EventDisplay.svelte'
    import EventList from '$lib/components/EventList.svelte'

    export let manager = new ParquetManager()
    let searchTerm = 'select * from events order by timestamp desc limit 10;'

    let events: AnalyticsEvent[] = []

    const runQuery = async () => {
        events = await dbManager.runQuery(searchTerm) ?? []
    }
</script>

<h1 class="text-red-700">Events</h1>

<button
  class="btn btn-primary"
  on:click={() => manager.downloadLast12Weeks()}
>Download last 12 weeks
</button>

<div>
  <textarea bind:value={searchTerm} />
  <button on:click={runQuery}>Search</button>
</div>

<EventList {events} />
