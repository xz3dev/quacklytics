<script lang="ts">
    import { createEventDispatcher, getContext } from 'svelte'
    import type { TrendInsight } from '$lib/components/insight/trends/TrendInsight'
    import { aggregationFunctions } from '$lib/local-queries'
    import type { Writable } from 'svelte/store'

    const insight = getContext<Writable<TrendInsight>>('insight')
    const dispatcher = createEventDispatcher()

    const setAggregation = (index: number, agg: string) => {
        // $insight.series[index].aggregations[0].function = agg
    }
</script>

<div>
  {$insight.id}
</div>
<div>
  <div class="font-semibold">Series</div>
  {#each $insight.series as series, i}

    <div
      class="flex flex-row p-2 border border-neutral rounded-lg gap-2 items-center"
    >
      <div class="rounded-full w-5 h-5 bg-amber-600"></div>

      <!-- event type -->
      <div class="dropdown">
        <div
          tabindex="0" role="button"
          class="btn btn-sm"
        >
          {series.filters.find(f => f.field.name === 'event_type')?.value}
        </div>
        <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
          <li><a>test_type</a></li>
          <li><a>Item 2</a></li>
        </ul>
      </div>

      <!-- aggregation -->
      <div class="dropdown">
        <div
          tabindex="0" role="button"
          class="btn btn-sm"
        >
          {series.aggregations[0].function}
        </div>
        <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
          {#each aggregationFunctions as func}
            <li>
              <button on:click={() => setAggregation(i, func)}>{func}</button>

            </li>
          {/each}
        </ul>
      </div>
    </div>
  {/each}
</div>
