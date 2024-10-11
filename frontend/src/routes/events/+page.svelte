<script lang="ts">
    import { ParquetManager } from '$lib/parquet-manager'

    export let manager = new ParquetManager()
</script>

<h1>Events</h1>

<button
  on:click={() => manager.downloadLast12Weeks()}
>Download last 12 weeks</button>

<!--<ul>-->
<!--  {#each (data.events ?? []) as event}-->
<!--    <li>-->
<!--      {event.id} - {event.eventType} - {event.timestamp} - {event.userId}-->
<!--      {#each Object.entries(event.properties) as [key, value]}-->
<!--         &nbsp;- {key}: {value}-->
<!--      {/each}-->
<!--    </li>-->
<!--  {/each}-->
<!--</ul>-->
