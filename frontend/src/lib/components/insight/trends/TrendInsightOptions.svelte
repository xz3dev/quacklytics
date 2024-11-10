<script lang="ts">
import { type Schema, schemaStore } from '$lib/client/schema'
import { insightColor } from '$lib/components/insight/Insight'
import FilterSelector from '$lib/components/insight/filters/FilterSelector.svelte'
import FilterSelectorCard from '$lib/components/insight/filters/FilterSelectorCard.svelte'
import {
    type TrendInsight,
    type TrendSeriesType,
    trendSeriesTypes,
} from '$lib/components/insight/trends/TrendInsight'
import { Button } from '$lib/components/ui/button'
import * as Card from '$lib/components/ui/card'
import * as Command from '$lib/components/ui/command'
import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
import * as Popover from '$lib/components/ui/popover'
import * as Select from '$lib/components/ui/select'
import {
    type AggregationFunction,
    type Field,
    type FieldFilter,
    type FieldType,
    type Operator,
    aggregationFunctions,
} from '$lib/local-queries'
import type { Selected } from 'bits-ui'
import {
    BarChart,
    Check,
    ChevronDown,
    ChevronsUpDown,
    LineChart,
    Plus,
    X,
} from 'lucide-svelte'
import { createEventDispatcher, getContext } from 'svelte'
import type { Writable } from 'svelte/store'

const insight = getContext<Writable<TrendInsight>>('insight')

const setAggregation = (
    index: number,
    agg: AggregationFunction,
    field?: Field,
) => {
    if ($insight.series?.[index]) {
        $insight.series[index].query.aggregations[0] = {
            function: agg,
            alias: 'result_value',
            field: field ?? { name: 'id', type: 'string' },
        }
    }
}

const selectedProperties: Field[] =
    $insight.series?.map((s) => s.query.aggregations[0]?.field) ?? []
const openPopover: boolean[] = $insight.series?.map(() => false) ?? []
const addFilterOpen: boolean[] = $insight.series?.map(() => false) ?? []

const setProperty = (index: number, property: Field) => {
    const series = $insight.series?.[index]
    if (!series) return
    selectedProperties[index] = property
    setAggregation(index, series.query.aggregations[0].function, property)
    openPopover[index] = false
}

const schema: Schema = $schemaStore
$: availableFields = [
    { name: 'event_type', type: 'string' },
    { name: 'timestamp', type: 'number' },
    ...schema.uniqueProperties,
] satisfies Field[]
$: console.log(schema)

function handleFilterChange(
    seriesIndex: number,
    filterIndex: number,
    newFilter?: FieldFilter,
) {
    const series = $insight.series?.[seriesIndex]
    if (!series) return
    const newFilters = [...series.query.filters]

    if (newFilter) {
        newFilters[filterIndex] = newFilter
    } else {
        newFilters.splice(filterIndex, 1)
    }
    series.query.filters = newFilters
    addFilterOpen[seriesIndex] = false
}

const handleAddSeries = () => {
    insight.update((updatedInsight) => {
        updatedInsight.series?.push({
            type: 'line',
            name: 'New Series',
            query: {
                filters: [],
                aggregations: [
                    {
                        function: 'COUNT',
                        alias: 'result_value',
                        field: { name: 'id', type: 'string' },
                    },
                ],
            },
        })
        return updatedInsight
    })
}

const handleRemoveSeries = (index: number) => {
    insight.update((updatedInsight) => {
        updatedInsight.series?.splice(index, 1)
        return updatedInsight
    })
}

function capitalizeFirstLetter(val: string) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1)
}

function trendSeriesTypeSelectable(
    type: TrendSeriesType | undefined,
): Selected<TrendSeriesType> {
    const value = type ?? 'line'
    return {
        value,
        label: capitalizeFirstLetter(value),
    }
}

function trendSeriesTypeSelected(
    index: number,
    type: Selected<TrendSeriesType> | undefined,
) {
    console.log(type)
    insight.update((updatedInsight) => {
        if (updatedInsight.series?.[index]) {
            updatedInsight.series[index].type = type?.value ?? 'line'
        }
        return updatedInsight
    })
}
</script>

{#each $insight.series ?? [] as series, i}
  <div class="flex flex-col mb-2">
    <div class="relative z-0 flex items-center gap-2">
      <div
        class="absolute h-[3px] w-full bg-red-950 top-[calc(50%-1.5px)] bottom-0 left-0 z-[-20]"
        style="background-color: {insightColor(i)}"
      ></div>
      <div class="flex flex-row gap-2 items-center flex-wrap z-0">
        <div
          class="self-stretch w-1 my-2 rounded-sm"
          style="background-color: {insightColor(i)}"
        ></div>

        <!-- Aggregation Dropdown -->
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild let:builder>
            <Button builders={[builder]} variant="outline" size="sm">
              {series.query.aggregations[0].function}
              <ChevronDown class="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            {#each aggregationFunctions as func}
              <DropdownMenu.Item
                on:click={() =>
                  setAggregation(
                    i,
                    func,
                    func === 'COUNT' ? { name: 'id', type: 'string' } : selectedProperties[i],
                  )}
              >
                {func}
              </DropdownMenu.Item>
            {/each}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        <!-- Property Command (Combobox) -->
        {#if series.query.aggregations[0].function !== 'COUNT'}
          <Popover.Root open={openPopover[i]} onOpenChange={(open) => (openPopover[i] = open)}>
            <Popover.Trigger asChild let:builder>
              <Button builders={[builder]} variant="outline" size="sm" role="combobox">
                {selectedProperties[i]?.name || 'Select property'}
                <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </Popover.Trigger>
            <Popover.Content class="w-[200px] p-0">
              <Command.Root>
                <Command.Input placeholder="Search property..." />
                <Command.Empty>No property found.</Command.Empty>
                <Command.Group>
                  {#each availableFields.filter((f) => f.type === 'number') as field}
                    <Command.Item onSelect={() => setProperty(i, field)}>
                      <Check
                        class={selectedProperties[i]?.name === field.name
                          ? 'opacity-100'
                          : 'opacity-0'}
                      />
                      <span>{field.name}</span>
                      <span class="ml-2 text-xs text-muted-foreground">{field.type}</span>
                    </Command.Item>
                  {/each}
                </Command.Group>
              </Command.Root>
            </Popover.Content>
          </Popover.Root>
        {/if}

        {#each series.query.filters as filter, j}
          <FilterSelector
            {filter}
            on:save={(event) => handleFilterChange(i, j, event.detail)}
            on:remove={() => handleFilterChange(i, j, undefined)}
          />
        {/each}
        <Popover.Root open={addFilterOpen[i]} onOpenChange={(open) => (addFilterOpen[i] = open)}>
          <Popover.Trigger asChild let:builder>
            <Button builders={[builder]} variant="outline" size="sm" class="h-8">
              <Plus class="h-4 w-4 mr-2" />
              Add Filter
            </Button>
          </Popover.Trigger>
          <Popover.Content class="w-80 p-0">
            <FilterSelectorCard
              on:add={(event) => handleFilterChange(i, series.query.filters.length, event.detail)}
              on:discard={() => handleFilterChange(i, series.query.filters.length, undefined)}
            />
          </Popover.Content>
        </Popover.Root>
      </div>
      <div class="flex-1"></div>

      <Select.Root
        selected={trendSeriesTypeSelectable(series?.type)}
        onSelectedChange={(type) => trendSeriesTypeSelected(i, type)}
      >
        <Select.Trigger class="w-[120px] bg-background hover:bg-gray-100">
          <Select.Value placeholder="Chart type">
            {series?.type}
          </Select.Value></Select.Trigger>
        <Select.Content>
          {#each trendSeriesTypes as type}
            <Select.Item value={type}>
              {capitalizeFirstLetter(type)}
            </Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <Button variant="outline" on:click={() => handleRemoveSeries(i)}>
        <X class="text-foreground-muted w-4 h-4" />
      </Button>
    </div>
  </div>
{/each}
<Button variant="secondary" on:click={handleAddSeries}>Add Series</Button>
