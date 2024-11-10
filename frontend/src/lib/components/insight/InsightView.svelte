<script lang="ts">
import type { Insight } from '$lib/components/insight/Insight'
import InsightMetaContainer from '$lib/components/insight/meta/InsightMetaContainer.svelte'
import InsightMetaView from '$lib/components/insight/meta/InsightMetaView.svelte'
import TrendInsightView from '$lib/components/insight/trends/TrendInsightView.svelte'
import { onMount, setContext } from 'svelte'
import { writable } from 'svelte/store'

export let insight: Insight | undefined

const insightStore = writable(insight)
setContext('insight', insightStore)
</script>

{#if insight}
  <InsightMetaContainer>
    {#if insight.type === 'Trend'}
      <TrendInsightView />
    {/if}
  </InsightMetaContainer>
{:else}
  <div>Insight not found</div>
{/if}
