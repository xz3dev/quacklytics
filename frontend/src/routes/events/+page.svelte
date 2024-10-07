<script lang="ts">
    import type { PageData } from './$types'

    export let data: PageData
</script>

<h1>Events</h1>

<ul>
  {#each data.events as event}
    <li>
      {event.id} - {event.eventType} - {event.timestamp} - {event.userId}
      {#each Object.entries(event.properties) as [key, value]}
         &nbsp;- {key}: {value}
      {/each}
    </li>
  {/each}
</ul>
