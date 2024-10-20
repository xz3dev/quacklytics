<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import * as Popover from '$lib/components/ui/popover';
    import * as Command from '$lib/components/ui/command';
    import { Button } from '$lib/components/ui/button';
    import { Plus, X, ChevronDown, Check, ArrowLeft } from 'lucide-svelte';
    import type { Field, FieldFilter, Operator } from '$lib/local-queries'

    export let filters: FieldFilter[] = [];
    export let availableFields: Field[] = [];
    export let availableOperators: Operator[] = ['=', '>', '<', '>=', '<=', '<>', 'LIKE', 'IN'];

    const dispatch = createEventDispatcher();

    let openPopover = false;
    let currentField: Field | null = null;
    let currentOperator: Operator | null = null;
    let currentValue: string = '';
    let step: 'field' | 'operator' | 'value' = 'field';

    function addFilter() {
        if (currentField && currentOperator && currentValue) {
            filters = [...filters, { field: currentField, operator: currentOperator, value: currentValue }];
            dispatch('change', filters);
            resetCurrentFilter();
        }
    }

    function removeFilter(index: number) {
        filters = filters.filter((_, i) => i !== index);
        dispatch('change', filters);
    }

    function resetCurrentFilter() {
        currentField = null;
        currentOperator = null;
        currentValue = '';
        step = 'field';
        openPopover = false;
    }

    function goBack() {
        if (step === 'operator') {
            step = 'field';
            currentOperator = null;
        } else if (step === 'value') {
            step = 'operator';
            currentValue = '';
        }
    }

    $: popoverTitle = step === 'field' ? 'Select Field' :
        step === 'operator' ? 'Select Operator' :
            'Enter Value';
</script>

<div class="flex flex-wrap gap-2 items-center">
  {#each filters as filter, index}
    <div class="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm">
      <span>{filter.field.name} {filter.operator} {filter.value}</span>
      <button on:click={() => removeFilter(index)} class="text-secondary-foreground/50 hover:text-secondary-foreground">
        <X class="h-4 w-4" />
      </button>
    </div>
  {/each}

  <Popover.Root bind:open={openPopover}>
    <Popover.Trigger asChild let:builder>
      <Button builders={[builder]} variant="outline" size="sm" class="h-8">
        <Plus class="h-4 w-4 mr-2" />
        Add Filter
      </Button>
    </Popover.Trigger>
    <Popover.Content class="w-80 p-0">
      <div class="flex items-center justify-between p-2 border-b">
        {#if step !== 'field'}
          <button on:click={goBack} class="p-1">
            <ArrowLeft class="h-4 w-4" />
          </button>
        {:else}
          <div class="w-4"></div>
        {/if}
        <span class="font-semibold">{popoverTitle}</span>
        <div class="w-4"></div>
      </div>

      {#if step === 'field'}
        <Command.Root>
          <Command.Input placeholder="Search fields..." />
          <Command.List>
            <Command.Group>
              {#each availableFields as field}
                <Command.Item
                  onSelect={() => { currentField = field; step = 'operator'; }}
                  class="flex items-center justify-between"
                >
                  <span>{field.name}</span>
                  {#if currentField?.name === field.name}
                    <Check class="h-4 w-4" />
                  {/if}
                </Command.Item>
              {/each}
            </Command.Group>
          </Command.List>
        </Command.Root>
      {:else if step === 'operator'}
        <Command.Root>
          <Command.List>
            <Command.Group>
              {#each availableOperators as operator}
                <Command.Item
                  onSelect={() => { currentOperator = operator; step = 'value'; }}
                  class="flex items-center justify-between"
                >
                  <span>{operator}</span>
                  {#if currentOperator === operator}
                    <Check class="h-4 w-4" />
                  {/if}
                </Command.Item>
              {/each}
            </Command.Group>
          </Command.List>
        </Command.Root>
      {:else}
        <div class="p-2">
          <input
            type="text"
            bind:value={currentValue}
            placeholder="Enter value"
            class="w-full p-2 border rounded"
          />
          <div class="flex justify-end mt-2">
            <Button on:click={addFilter} disabled={!currentValue}>
              Add Filter
            </Button>
          </div>
        </div>
      {/if}
    </Popover.Content>
  </Popover.Root>
</div>
