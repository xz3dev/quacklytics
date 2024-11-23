<script lang="ts">
import { type Schema, schemaStore } from '$lib/client/schema'
import { insightColor } from '$lib/components/insight/Insight'
import FilterSelector from '$lib/components/insight/filters/FilterSelector.svelte'
import FilterSelectorCard from '$lib/components/insight/filters/FilterSelectorCard.svelte'
import {
    type TrendAggregationFunction,
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
    aggregationFunctions,
} from '$lib/queries/aggregations'
import type { Field, FieldFilter, FieldType } from '$lib/queries/field'
import type { Operator } from '$lib/queries/operators'
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

interface TrendAggregationOptions {
    name: string
    func: TrendAggregationFunction
    distinct?: Field
}
const trendAggregationOptions: TrendAggregationOptions[] = [
    {
        name: 'Count',
        func: 'COUNT',
        distinct: { name: 'id', type: 'string' },
    },
    {
        name: 'Distinct Users',
        func: 'COUNT',
        distinct: { name: 'user_id', type: 'string' },
    },
    {
        name: 'Sum',
        func: 'SUM',
    },
    {
        name: 'Average',
        func: 'AVG',
    },
    {
        name: 'Minimum',
        func: 'MIN',
    },
    {
        name: 'Maximum',
        func: 'MAX',
    },
]

const setAggregation = (
    index: number,
    agg: AggregationFunction,
    field?: Field,
    distinct?: boolean,
) => {
    if ($insight.series?.[index]?.query) {
        $insight.series[index].query.aggregations[0] = {
            function: agg,
            alias: 'result_value',
            field: field ?? { name: 'id', type: 'string' },
            distinct,
        }
    }
}

const selectedProperties: Field[] =
    $insight.series
        ?.map((s) => s.query?.aggregations?.[0]?.field)
        ?.filter((f) => f !== undefined) ?? []
const openPopover: boolean[] = $insight.series?.map(() => false) ?? []
const addFilterOpen: boolean[] = $insight.series?.map(() => false) ?? []

const setProperty = (index: number, property: Field) => {
    const series = $insight.series?.[index]
    if (!series?.query?.aggregations[0].function) return
    selectedProperties[index] = property
    setAggregation(index, series.query?.aggregations[0].function, property)
    openPopover[index] = false
}

const schema: Schema = $schemaStore
$: availableFields = [
    { name: 'event_type', type: 'string' },
    { name: 'timestamp', type: 'number' },
    ...schema.uniqueProperties,
] satisfies Field[]

function handleFilterChange(
    seriesIndex: number,
    filterIndex: number | undefined,
    newFilter?: FieldFilter,
) {
    console.log(seriesIndex, filterIndex, newFilter)
    const series = $insight.series?.[seriesIndex]
    if (!series) {
        return
    }
    const newFilters = [...(series.query?.filters ?? [])]
    if (newFilter) {
        if (filterIndex === undefined) {
            console.log(newFilters.slice())
            newFilters.push(newFilter)
            console.log(newFilters.slice())
        } else {
            newFilters[filterIndex] = newFilter
        }
    } else {
        if (filterIndex !== undefined) {
            newFilters.splice(filterIndex, 1)
        }
    }

    addFilterOpen[seriesIndex] = false
    insight.update((updatedInsight) => {
        if (!updatedInsight.series) {
            updatedInsight.series = []
        }
        if (!updatedInsight.series[seriesIndex]) return updatedInsight
        if (!updatedInsight.series[seriesIndex].query) {
            updatedInsight.series[seriesIndex].query = {
                filters: [],
                aggregations: [],
            }
        }
        updatedInsight.series[seriesIndex].query.filters = newFilters
        return updatedInsight
    })
}

const handleAddSeries = () => {
    insight.update((updatedInsight) => {
        updatedInsight.series?.push({
            visualisation: 'line',
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
            updatedInsight.series[index].visualisation = type?.value ?? 'line'
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
              {series.query?.aggregations[0].function}
              <ChevronDown class="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content>
            {#each trendAggregationOptions as o}
              <DropdownMenu.Item
                on:click={() =>
                  setAggregation(
                    i,
                    o.func,
                    o.distinct ? o.distinct : selectedProperties[i],
                    !!o.distinct,
                  )}
              >
                {o.name}
              </DropdownMenu.Item>
            {/each}
          </DropdownMenu.Content>
        </DropdownMenu.Root>

        <!-- Property Command (Combobox) -->
        {#if series.query?.aggregations[0].function !== 'COUNT'}
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

        {#each (series.query?.filters ?? []) as filter, j}
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
              on:save={(event) => handleFilterChange(i, undefined, event.detail)}
              on:discard={() => handleFilterChange(i, undefined, undefined)}
            />
          </Popover.Content>
        </Popover.Root>
      </div>
      <div class="flex-1"></div>

      <Select.Root
        selected={trendSeriesTypeSelectable(series?.visualisation)}
        onSelectedChange={(type) => trendSeriesTypeSelected(i, type)}
      >
        <Select.Trigger class="w-[120px] bg-background hover:bg-gray-100">
          <Select.Value placeholder="Chart type">
            {series?.visualisation}
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
