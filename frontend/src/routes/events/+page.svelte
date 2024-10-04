<script lang="ts">
    import type { PageData } from './$types'

    export let data: PageData
</script>

<h1>Events</h1>

<ul>
  {#each data.events as event}
    <li>{event.id} - {event.timestamp} - {event.eventType} - {event.userId}</li>
  {/each}
</ul>
