<!-- FilterItem.svelte -->
<script lang="ts">
import FilterSelectorCard from '$lib/components/insight/filters/FilterSelectorCard.svelte'
import { Button } from '$lib/components/ui/button'
import * as Popover from '$lib/components/ui/popover'
import type { FieldFilter } from '$lib/queries/field'
import { X } from 'lucide-svelte'
import { createEventDispatcher } from 'svelte'

export let filter: FieldFilter
let isOpen: boolean

const dispatch = createEventDispatcher()
</script>

<div class="flex">
  <Popover.Root bind:open={isOpen}>
    <Popover.Trigger let:builder>
      <Button
        builders={[builder]}
        variant="outline"
        size="sm"
        class="h-8 mr-0 rounded-r-none pr-0"
        on:click={() => (isOpen = !isOpen)}
      >
        <span class="mr-2">{filter.field.name} {filter.operator} {filter.value}</span>
      </Button>
    </Popover.Trigger>
    <Popover.Content class="w-80 p-0">
      <FilterSelectorCard
        initialFilter={filter}
        on:save={(event) => {
          dispatch('save', event.detail);
          isOpen = false;
        }}
        on:discard={() => (isOpen = false)}
      />
    </Popover.Content>
  </Popover.Root>

  <Button
    variant="outline"
    size="sm"
    class="h-8 rounded-l-none pl-2 border-l-0"
    on:click={() => {
      isOpen = false;
      return dispatch('remove');
    }}
  >
    <X class="h-4 w-4" />
  </Button>
</div>
