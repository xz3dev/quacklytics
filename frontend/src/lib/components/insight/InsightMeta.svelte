<script lang="ts">
    import { getContext } from 'svelte'
    import { Insight, timeBuckets } from '$lib/components/insight/Insight.js'
    import type { Writable } from 'svelte/store'
    import * as Popover from '$lib/components/ui/popover'
    import { Button } from '$lib/components/ui/button'
    import { CalendarDays } from 'lucide-svelte'
    import moment from 'moment'
    import { RangeCalendar } from '$lib/components/ui/range-calendar'
    import {
        getLocalTimeZone, now, startOfMonth, endOfMonth,
    } from '@internationalized/date'

    const insight = getContext<Writable<Insight>>('insight')
    let isOpen = false

    let date = {
        start: now(getLocalTimeZone()).subtract({ days: 30 }),
        end: now(getLocalTimeZone()),
    }

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

    const buckets = timeBuckets

    $: dateRangeText = date?.start && date?.end
        ? `${moment(date.start.toDate()).format('MMM DD, YYYY')} - ${moment(date.end.toDate()).format('MMM DD, YYYY')}`
        : 'Select date range'

</script>

<Popover.Root bind:open={isOpen}>
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
                    isOpen = false
                }}
      >
        Reset
      </Button>
      <Button
        size="sm"
        on:click={() => {
                    if (date?.start && date?.end) {
                        isOpen = false
                    }
                }}
      >
        Apply
      </Button>
    </div>
  </Popover.Content>
</Popover.Root>
