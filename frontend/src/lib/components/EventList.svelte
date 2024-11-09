<script lang="ts">
  import type { AnalyticsEvent } from '$lib/event';
  import Time from 'svelte-time';
  import Icon from '@iconify/svelte';

  export let events: AnalyticsEvent[];
  let expanded: string | undefined;
</script>

<div class="w-full overflow-auto">
  <table class="border border-neutral table-auto w-full">
    <colgroup>
      <col class="w-0" />
      <col class="" />
      <col class="" />
      <col class="" />
    </colgroup>
    <thead>
      <tr>
        <th></th>
        <th class="border border-neutral">EVENT</th>
        <th class="border border-neutral">PERSON</th>
        <th class="border border-neutral">TIME</th>
      </tr>
    </thead>
    <tbody>
      {#each events as event}
        <tr class="text-sm whitespace-nowrap">
          <td class="border border-neutral">
            <butto on:click={() => (expanded = expanded != event.id ? event.id : undefined)}>
              <Icon icon="material-symbols:expand-all-rounded" height="24px" width="24px"></Icon>
            </butto>
          </td>
          <td class="border border-neutral">{event.eventType}</td>
          <td class="border border-neutral">{event.userId}</td>
          <td class="border border-neutral">
            <Time timestamp={event.timestamp} relative></Time>
          </td>
        </tr>
        {#if expanded === event.id}
          <tr>
            <td colspan="4" class="border border-neutral">
              <div>
                {#each Object.entries(event.properties) as [key, value]}
                  <div class="flex justify-between gap-2">
                    <div>{key}</div>
                    <div>{value}</div>
                  </div>
                {/each}
              </div>
            </td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>

<style>
  th,
  td {
    padding: 0.5rem;
  }

  table,
  th,
  td {
    border-collapse: collapse;
  }
</style>
