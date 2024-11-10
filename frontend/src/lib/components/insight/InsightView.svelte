<script lang="ts">
import { insightsStore } from '$lib/client/insights.js'
import type { Insight } from '$lib/components/insight/Insight'
import InsightMetaContainer from '$lib/components/insight/meta/InsightMetaContainer.svelte'
import InsightMetaView from '$lib/components/insight/meta/InsightMetaView.svelte'
import TrendInsightView from '$lib/components/insight/trends/TrendInsightView.svelte'
import { Button } from '$lib/components/ui/button'
import * as Card from '$lib/components/ui/card/index.js'
import { X } from 'lucide-svelte'
import { onMount, setContext } from 'svelte'
import { writable } from 'svelte/store'

export let insight: Insight | undefined

let original = structuredClone(insight)
original = structuredClone(insight)

const insightStore = writable(insight)
setContext('insight', insightStore)

$: isDirty = JSON.stringify(original) !== JSON.stringify($insightStore)
$: console.log('insights', $insightsStore)
</script>


<Card.Root>
  {#if insight}
    <Card.Header>
      <div class="flex items-center gap-2">
        <h2 class="font-semibold text-lg">•
          {insight.name}
        </h2>
        <div class="flex-1"></div>
        <div
          class="flex items-center gap-2 {!isDirty ? 'invisible' : ''}"
        >
          <Button
            variant="outline"
            on:click={() => {if(original) insightStore.set(original)}}
          >
            Discard Changes
          </Button>
          <Button
            variant="default"
            on:click={async () => {
              await insightsStore.update($insightStore)
              original = structuredClone($insightStore)
            }}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </Card.Header>
    <Card.Content>
      <InsightMetaContainer>
        {#if insight.type === 'Trend'}
          <TrendInsightView />
        {/if}
      </InsightMetaContainer>
    </Card.Content>
  {:else}
    <Card.Content>
      Insight not found / Loading...
    </Card.Content>
  {/if}
</Card.Root>
