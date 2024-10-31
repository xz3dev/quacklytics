<script lang="ts">
    import { createEventDispatcher, getContext } from 'svelte'
    import type { TrendInsight } from '$lib/components/insight/trends/TrendInsight'
    import {
        type AggregationFunction,
        aggregationFunctions,
        type Field,
        type FieldFilter,
        type Operator,
    } from '$lib/local-queries'
    import type { Writable } from 'svelte/store'
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
    import * as Card from '$lib/components/ui/card'
    import * as Popover from '$lib/components/ui/popover'
    import * as Command from '$lib/components/ui/command'
    import { Button } from '$lib/components/ui/button'
    import { Check, ChevronDown, ChevronsUpDown, Plus, X } from 'lucide-svelte'
    import FilterSelector from '$lib/components/insight/filters/FilterSelector.svelte'
    import FilterSelectorCard from '$lib/components/insight/filters/FilterSelectorCard.svelte'

    const insight = getContext<Writable<TrendInsight>>('insight')
    const dispatcher = createEventDispatcher()

    const setAggregation = (index: number, agg: AggregationFunction, field?: string) => {
        $insight.series[index].aggregations[0] = {
            function: agg,
            alias: 'result_value',
            field: { name: field ?? 'id' },
        }
    }

    // Add a list of properties that can be aggregated
    const properties = ['id', 'timestamp', '$properties.value', '$properties.count'] // Add more as needed

    let selectedProperties: string[] = $insight.series.map(s => s.aggregations[0].field.name)
    let openPopover: boolean[] = $insight.series.map(() => false)
    let addFilterOpen: boolean[] = $insight.series.map(() => false)

    const setProperty = (index: number, property: string) => {
        selectedProperties[index] = property
        setAggregation(index, $insight.series[index].aggregations[0].function, property)
        openPopover[index] = false
    }

    const availableFields: Field[] = [
        { name: 'event_type' },
        { name: 'timestamp' },
        { name: '$.prop_0' },
        { name: '$.count' },
        // Add more fields as needed
    ]

    function handleFilterChange(seriesIndex: number, filterIndex: number, newFilter?: FieldFilter) {
        const newFilters = [...$insight.series[seriesIndex].filters]
        if (newFilter) {
            newFilters[filterIndex] = newFilter
        } else {
            newFilters.splice(filterIndex, 1)
        }
        $insight.series[seriesIndex].filters = newFilters
        addFilterOpen[seriesIndex] = false
    }

    const handleAddSeries = () => {
        insight.update(updatedInsight => {
            updatedInsight.series.push({
                name: 'New Series',
                filters: [],
                aggregations: [
                    {
                        function: 'COUNT',
                        alias: 'result_value',
                        field: { name: 'id' },
                    },
                ],
            })
            return updatedInsight
        })
    }

    const handleRemoveSeries = (index: number) => {
        insight.update(updatedInsight => {
            updatedInsight.series.splice(index, 1)
            return updatedInsight
        })
    }
</script>

{#each $insight.series as series, i}
  <div class="rounded-lg flex flex-col p-2 mb-2">
    <div class="flex items-center">
      <div class="mr-2 rounded-full w-5 h-5 bg-amber-600 flex-shrink-0"></div>
      <div class="flex flex-row gap-2 items-center flex-wrap">
        <!-- Aggregation Dropdown -->
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild let:builder>
            <Button builders={[builder]} variant="outline" size="sm">
              {series.aggregations[0].function}
              <ChevronDown class="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            {#each aggregationFunctions as func}
              <DropdownMenu.Item on:click={() => setAggregation(i, func, selectedProperties[i])}>
                {func}
              </DropdownMenu.Item>
            {/each}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        <!-- Property Command (Combobox) -->
        <Popover.Root open={openPopover[i]} onOpenChange={(open) => openPopover[i] = open}>
          <Popover.Trigger asChild let:builder>
            <Button builders={[builder]} variant="outline" size="sm" role="combobox">
              {selectedProperties[i] || "Select property"}
              <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </Popover.Trigger>
          <Popover.Content class="w-[200px] p-0">
            <Command.Root>
              <Command.Input placeholder="Search property..." />
              <Command.Empty>No property found.</Command.Empty>
              <Command.Group>
                {#each properties as property}
                  <Command.Item onSelect={() => setProperty(i, property)}>
                    <Check class={selectedProperties[i] === property ? "opacity-100" : "opacity-0"} />
                    <span>{property}</span>
                  </Command.Item>
                {/each}
              </Command.Group>
            </Command.Root>
          </Popover.Content>
        </Popover.Root>

        {#each series.filters as filter, j}
          <FilterSelector
            filter={filter}
            on:save={(event) => handleFilterChange(i, j, event.detail)}
            on:remove={() => handleFilterChange(i, j, undefined)}
          />
        {/each}
        <Popover.Root open={addFilterOpen[i]} onOpenChange={(open) => addFilterOpen[i] = open}>
          <Popover.Trigger asChild let:builder>
            <Button builders={[builder]} variant="outline" size="sm" class="h-8">
              <Plus class="h-4 w-4 mr-2" />
              Add Filter
            </Button>
          </Popover.Trigger>
          <Popover.Content class="w-80 p-0">
            <FilterSelectorCard
              availableFields={availableFields}
              on:add={(event) => handleFilterChange(i, series.filters.length, event.detail)}
              on:discard={() => handleFilterChange(i, series.filters.length, undefined)}
            />
          </Popover.Content>
        </Popover.Root>
      </div>
      <div class="flex-1"></div>
      <Button
        variant="ghost"
        on:click={() => handleRemoveSeries(i)}
      >
        <X class="text-foreground-muted w-4 h-4" />
      </Button>
    </div>
  </div>
{/each}
<Button
  variant="secondary"
  on:click={handleAddSeries}
>Add Series
</Button>
  
