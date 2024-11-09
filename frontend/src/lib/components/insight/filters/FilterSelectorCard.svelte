<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import * as Popover from '$lib/components/ui/popover';
  import * as Command from '$lib/components/ui/command';
  import * as Select from '$lib/components/ui/select';
  import { Check, ChevronsUpDown } from 'lucide-svelte';
  import type { Field, FieldFilter, Operator } from '$lib/local-queries';
  import type { Selected } from 'bits-ui';
  import { type Schema, schemaStore } from '$lib/client/schema';

  const schema: Schema = $schemaStore;
  $: availableFields = [
    { name: 'event_type', type: 'string' },
    ...schema.uniqueProperties,
  ] satisfies Field[];

  $: eventTypes = Object.keys(schema.events);

  $: propertyValues = schema.propertyValues;
  export let allOperators: Operator[] = ['=', '>', '<', '>=', '<=', '<>', 'LIKE', 'IN'];
  export let initialFilter: FieldFilter | null = null;

  const dispatch = createEventDispatcher();

  let currentField: Field | null = null;
  let currentOperator: Selected<Operator> | undefined;
  let currentValue: string = '';
  let openField = false;
  let openValue = false;

  $: isInitial =
    (initialFilter &&
      currentField === initialFilter.field &&
      currentOperator?.value === initialFilter.operator &&
      currentValue === initialFilter.value) ||
    (!currentField && !currentOperator && !currentValue);

  onMount(() => {
    if (initialFilter) {
      currentField = initialFilter.field;
      currentOperator = {
        value: initialFilter.operator,
        label: initialFilter.operator,
      };
      currentValue = initialFilter.value.toString();
    }
  });

  function addFilter() {
    if (currentField && currentOperator && currentValue) {
      const newFilter: FieldFilter = {
        field: currentField,
        operator: currentOperator?.value,
        value: currentValue,
      };
      dispatch('save', newFilter);
      resetFields();
    }
  }

  function resetFields() {
    currentField = null;
    currentOperator = undefined;
    currentValue = '';
  }

  function handleDiscard() {
    resetFields();
    dispatch('discard');
  }
</script>

<Card.Root class="w-full max-w-md border-0 shadow-none overflow-hidden">
  <Card.Header>
    <Card.Title>{initialFilter ? 'Edit Filter' : 'Add Filter'}</Card.Title>
  </Card.Header>
  <Card.Content class="space-y-4">
    <div class="space-y-2">
      <label class="text-sm font-medium">Field</label>
      <Popover.Root bind:open={openField}>
        <Popover.Trigger asChild let:builder>
          <Button
            builders={[builder]}
            variant="outline"
            role="combobox"
            aria-expanded={openField}
            class="w-full justify-between"
          >
            <span>
              {currentField ? currentField.name : 'Select field...'}
              <span class="text-muted-foreground text-xs ml-2">{currentField?.type ?? ''}</span>
            </span>
            <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </Popover.Trigger>
        <Popover.Content class="w-[var(--radix-popover-trigger-width)] p-0">
          <Command.Root>
            <Command.Input placeholder="Search field..." />
            <Command.Empty>No field found.</Command.Empty>
            <Command.Group>
              {#each availableFields as field}
                <Command.Item
                  value={field.name}
                  onSelect={() => {
                    currentField = field;
                    openField = false;
                  }}
                >
                  <Check
                    class={currentField?.name === field.name
                      ? 'mr-2 h-4 w-4'
                      : 'mr-2 h-4 w-4 invisible'}
                  />
                  {field.name}
                  <span class="text-muted-foreground text-xs ml-2">{field.type}</span>
                </Command.Item>
              {/each}
            </Command.Group>
          </Command.Root>
        </Popover.Content>
      </Popover.Root>
    </div>

    <div class="space-y-2">
      <label class="text-sm font-medium">Filter</label>
      <Select.Root bind:selected={currentOperator}>
        <Select.Trigger class="w-full">
          <Select.Value placeholder="Select operator" />
        </Select.Trigger>
        <Select.Content>
          {#each allOperators as operator}
            <Select.Item value={operator}>{operator}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <div class="space-y-2">
      <label class="text-sm font-medium">Value</label>
      <Popover.Root bind:open={openValue}>
        <Popover.Trigger asChild let:builder>
          <Button
            builders={[builder]}
            variant="outline"
            role="combobox"
            aria-expanded={openValue}
            class="w-full justify-between"
          >
            {currentValue || 'Enter value...'}
            <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </Popover.Trigger>
        <Popover.Content class="p-0" style="width: var(--radix-popover-trigger-width);">
          <Command.Root>
            <Command.Input placeholder="Enter value" bind:value={currentValue} />
            <Command.Empty>No suggestion found.</Command.Empty>
            <Command.Group class="overflow-y-auto max-h-[300px]">
              {#if currentField?.name === 'event_type'}
                {#each eventTypes as type}
                  <Command.Item
                    value={type}
                    onSelect={() => {
                      currentValue = type;
                      openValue = false;
                    }}
                  >
                    <Check
                      class={currentValue === type ? 'mr-2 h-4 w-4' : 'mr-2 h-4 w-4 invisible'}
                    />
                    {type}
                  </Command.Item>
                {/each}
              {/if}
              {#if currentField}
                {#each propertyValues[currentField.name] ?? [] as val}
                  <Command.Item
                    value={val}
                    onSelect={() => {
                      currentValue = val;
                      openValue = false;
                    }}
                  >
                    <Check
                      class={currentValue === val ? 'mr-2 h-4 w-4' : 'mr-2 h-4 w-4 invisible'}
                    />
                    {val}
                  </Command.Item>
                {/each}
              {/if}
            </Command.Group>
          </Command.Root>
        </Popover.Content>
      </Popover.Root>
    </div>
  </Card.Content>
  <Card.Footer class="flex justify-end space-x-2">
    <Button variant="outline" on:click={handleDiscard}>
      {#if isInitial}
        Cancel
      {:else}
        Discard Changes
      {/if}
    </Button>
    <Button on:click={addFilter}>{initialFilter ? 'Update' : 'Create'}</Button>
  </Card.Footer>
</Card.Root>
