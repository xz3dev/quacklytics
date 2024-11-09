<script lang="ts">
    import { getContext, setContext } from 'svelte'
    import { type TimeBucket, timeBucketLabels, timeBuckets } from '$lib/components/insight/Insight.js'
    import type { Writable } from 'svelte/store'
    import * as Popover from '$lib/components/ui/popover'
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
    import { Button } from '$lib/components/ui/button'
    import { CalendarDays, ChevronDown } from 'lucide-svelte'
    import moment from 'moment'
    import { RangeCalendar } from '$lib/components/ui/range-calendar'
    import {
        getLocalTimeZone, now, startOfMonth, endOfMonth,
    } from '@internationalized/date'
    import { createInsightMetaStore } from '$lib/components/insight/meta/InsightMeta'

    let isTimeRangeSelectionOpen = false

    const defaultRange = {
        start: now(getLocalTimeZone()).subtract({ days: 30 }),
        end: now(getLocalTimeZone()),
    }

    let date = defaultRange
    // Preset date ranges
    const presets = {
        'Last 7 Days': () => {
            date = {
                start: now(getLocalTimeZone()).subtract({ days: 7 }),
                end: now(getLocalTimeZone()),
            }
        },
        'Last 30 Days': () => {
            date = {
                start: now(getLocalTimeZone()).subtract({ days: 30 }),
                end: now(getLocalTimeZone()),
            }
        },
        'This Month': () => {
            date = {
                start: startOfMonth(now(getLocalTimeZone())),
                end: now(getLocalTimeZone()),
            }
        },
        'Last Month': () => {
            date = {
                start: startOfMonth(now(getLocalTimeZone()).subtract({ months: 1 })),
                end: endOfMonth(now(getLocalTimeZone()).subtract({ months: 1 })),
            }
        },
    }

    let bucket: TimeBucket = timeBuckets[0]
    const buckets = timeBuckets
    const selectBucket = (newBucket: TimeBucket) => {
        bucket = newBucket
    }

    const store = createInsightMetaStore({
        range: {
            start: date.start.toDate(),
            end: date.end.toDate(),
        },
        timeBucket: bucket,
    })
    setContext('insightMeta', store)

    $: console.log(date)
    $: store.update(({
        range: date.start && date.end ? {
            start: date.start.toDate(),
            end: moment(date.end.toDate()).endOf('day').toDate(),
        } : {
            start: defaultRange.start.toDate(),
            end: defaultRange.end.toDate()
        },
        timeBucket: bucket,
    }))


    $: dateRangeText = date?.start && date?.end
        ? `${moment(date.start.toDate()).format('MMM DD, YYYY')} - ${moment(date.end.toDate()).format('MMM DD, YYYY')}`
        : 'Select date range'

    let value

    $: console.log(value)
</script>

<div class="flex items-center gap-2 w-full mb-4">
  <Popover.Root bind:open={isTimeRangeSelectionOpen}>
    <Popover.Trigger asChild let:builder>
      <Button
        builders={[builder]}
        variant="outline"
        class="w-[280px] justify-start text-left font-normal"
      >
        <CalendarDays class="mr-2 h-4 w-4" />
        {dateRangeText}
      </Button>
    </Popover.Trigger>
    <Popover.Content class="w-auto p-0" align="start">
      <div class="p-4">
        <!-- Preset buttons -->
        <div class="flex flex-wrap gap-2 mb-4">
          {#each Object.entries(presets) as [label, handler]}
            <Button
              variant="outline"
              size="sm"
              on:click={handler}
            >
              {label}
            </Button>
          {/each}
        </div>

        <!-- Calendar -->
        <div class="space-y-2">
          <RangeCalendar
            bind:value={date}
            numberOfMonths={2}
          />
        </div>
      </div>

      <!-- Action buttons -->
      <div class="flex justify-end gap-2 p-4 border-t">
        <Button
          variant="outline"
          size="sm"
          on:click={() => {
                    // date = {
                    //     from: undefined,
                    //     to: undefined
                    // }
                    isTimeRangeSelectionOpen = false
                }}
        >
          Reset
        </Button>
        <Button
          size="sm"
          on:click={() => {
                    if (date?.start && date?.end) {
                        isTimeRangeSelectionOpen = false
                    }
                }}
        >
          Apply
        </Button>
      </div>
    </Popover.Content>
  </Popover.Root>


  <div class="text-sm text-muted-foreground">
    grouped by
  </div>

  <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild let:builder>
      <Button builders={[builder]} variant="outline" size="sm">
        {timeBucketLabels[bucket]}
        <ChevronDown class="h-4 w-4 ml-2" />
      </Button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content>
      {#each buckets as bucket}
        <DropdownMenu.Item on:click={() => selectBucket(bucket)}>
          {timeBucketLabels[bucket]}
        </DropdownMenu.Item>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Root>

</div>
<slot />
