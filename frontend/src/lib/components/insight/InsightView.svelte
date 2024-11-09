<script lang="ts">
    import InsightMetaView from '$lib/components/insight/meta/InsightMetaView.svelte'
    import TrendInsightView from '$lib/components/insight/trends/TrendInsightView.svelte'
    import { writable } from 'svelte/store'
    import { onMount, setContext } from 'svelte'
    import type { Insight } from '$lib/components/insight/Insight'

    export let insight: Insight | undefined

    const insightStore = writable(insight)
    setContext('insight', insightStore)
</script>
{#if insight}
  <InsightMetaView>
    {#if insight.type === 'Trend'}
      <TrendInsightView />
    {/if}
  </InsightMetaView>
{:else}
  <div>Insight not found</div>
{/if}
