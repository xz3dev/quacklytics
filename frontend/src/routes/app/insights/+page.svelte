<script lang="ts">
import { goto } from '$app/navigation'
import { insightsStore } from '$lib/client/insights'
import { Button } from '$lib/components/ui/button'
import { Input } from '$lib/components/ui/input'
import * as Popover from '$lib/components/ui/popover'
import DataTable, { type Api, type CellMetaSettings } from 'datatables.net-dt'
import { ChartNoAxesCombined } from 'lucide-svelte'
import moment from 'moment'
import { onMount } from 'svelte'
import { DotsHorizontal } from 'svelte-radix'
import ActionMenu from './ActionMenu.svelte'

const insights = $insightsStore
let table: Api<unknown>
const searchValue = ''

const data = [...insights].map((insight) => ({
    id: insight.id,
    name: insight.name,
    createdAt: insight.createdAt, //moment().fromNow(),
    updatedAt: insight.updatedAt, //moment().fromNow(),
}))

let openMenu: number | undefined

onMount(() => {
    table = new DataTable('#igrid', {
        order: [[1, 'desc']],
        columns: [
            {
                data: 'id',
                name: 'ID',
                visible: false,
            },
            {
                data: 'name',
                name: 'Name',
                width: '65%',
                render: (data, type, row, meta: CellMetaSettings) => {
                    const target = document.createElement('a')
                    target.classList.add(
                        'flex',
                        'items-center',
                        'gap-2',
                        'font-bold',
                        'hover:underline',
                    )
                    target.href = `/app/insight/${row.id}`
                    new ChartNoAxesCombined({
                        target,
                        props: { class: 'h-5 w-5 text-muted-foreground' },
                    })
                    target.innerHTML = `${target.innerHTML}<span>${data}</span>`
                    return target
                },
            },
            { data: 'createdAt', name: 'Created At', width: '200px' },
            { data: 'updatedAt', name: 'Updated At', width: '200px' },
            {
                data: '',
                name: '',
                width: '80px',
                orderable: false,
                render: (data, type, row, meta: CellMetaSettings) => {
                    const target = document.createElement('div')
                    new ActionMenu({
                        target,
                        props: {
                            rowIndex: meta.row,
                            openMenu,
                        },
                    })
                    return target
                },
            },
        ],
        layout: {
            topEnd: 'search',
        },
        search: {
            smart: true, // Enable smart search
            regex: false, // Disable regex search
            caseInsensitive: true, // Case insensitive search
        },
        searching: true,
        paging: false,
        info: false,
    })
})

async function createInsight() {
    const insight = await insightsStore.create()
    if (insight) {
        await goto(`/app/insight/${insight.id}`)
    }
}
</script>

<div class="container mx-auto p-4">
  <div class="flex justify-between items-center mb-4">
    <h1 class="text-2xl font-bold">Insights {openMenu}</h1>
    <Button
      variant="default"
      on:click={() => createInsight()}
    >Create Insight</Button>
  </div>

  <table id="igrid" class="display w-full">
    <thead>
      <tr>
      <th>ID</th>
        <th>Name</th>
        <th>Created At</th>
        <th>Updated At</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each data as row, i}
        <tr>
          <td>{row.id}</td>
          <td>
              {row.name}
          </td>
          <td>{moment(row.createdAt).fromNow()}</td>
          <td>{moment(row.updatedAt).fromNow()}</td>
          <td>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
