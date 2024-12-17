<script lang="ts">
import { insightsStore } from '$lib/client/insights.js'
import type { Insight } from '$lib/components/insight/Insight'
import InsightMetaContainer from '$lib/components/insight/meta/InsightMetaContainer.svelte'
import InsightMetaView from '$lib/components/insight/meta/InsightMetaView.svelte'
import TrendInsightView from '$lib/components/insight/trends/TrendInsightView.svelte'
import { Button } from '$lib/components/ui/button'
import * as Card from '$lib/components/ui/card/index.js'
import { Check, Edit, X } from 'lucide-svelte'
import { onMount, setContext } from 'svelte'
import { writable } from 'svelte/store'
import { Input } from '$lib/components/ui/input'

export let insight: Insight | undefined = undefined

let original = structuredClone(insight)
original = structuredClone(insight)

const insightStore = writable(insight)
setContext('insight', insightStore)

$: isDirty = JSON.stringify(original) !== JSON.stringify($insightStore)
let editing = false
let nameOriginal = insight?.name
let name = insight?.name

const setName = (name: string | undefined) => {
  editing = false
  nameOriginal = name
  insightStore.update(insight => {
    insight.name = name
    return insight
  })
}
</script>


<Card.Root>
  {#if insight}
    <Card.Header>
      <div class="flex items-center gap-2">
        <h2 class="font-semibold text-lg">
          {#if editing}
            <div class="flex items-center gap-2">
              <Input
                class="max-w-md min-w-md"
                bind:value={name}
              />
              <Button variant="ghost"on:click={() => setName(name)}><Check class="w-4 h-4" /></Button>
              <Button variant="ghost" on:click={() => setName(nameOriginal)}>
                <X class="w-4 h-4" />
              </Button>
            </div>
          {:else}
            <button 
              class="cursor-pointer flex items-center gap-2" 
              on:click={() => editing = true}
            >
              {$insightStore.name}
              <Edit class="w-4 h-4" />
            </button>
          {/if}
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
              console.log($insightStore)
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
