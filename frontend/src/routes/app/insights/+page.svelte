<script lang="ts">
    import { insightsStore } from '$lib/client/insights'
    import moment from 'moment'
    import { Button } from '$lib/components/ui/button'
    import { Input } from '$lib/components/ui/input'
    import { onMount } from 'svelte'
    import DataTable from 'datatables.net-dt'

    const insights = $insightsStore
    let table: DataTable
    let searchValue = ''

    const data = [
        ...insights,
    ].map(insight => ({
        id: insight.id,
        name: insight.name,
        createdAt: insight.createdAt, //moment().fromNow(),
        updatedAt: insight.updatedAt, //moment().fromNow(),
    }))

    onMount(() => {
        table = new DataTable('#igrid', {
            order: [[1, 'desc']],
            columns: [
                { data: 'name', name: 'Name', width: '75%' },
                { data: 'createdAt', name: 'Created At', width: '200px' },
                { data: 'updatedAt', name: 'Updated At', width: '200px' },
            ],
            layout: {
                topEnd: 'search',
            },
            search: {
                smart: true,           // Enable smart search
                regex: false,          // Disable regex search
                caseInsensitive: true, // Case insensitive search
            },
            searching: true,
            paging: false,
            info: false,
        })
    })
</script>

<div class="container mx-auto p-4">
  <div class="flex justify-between items-center mb-4">
    <h1 class="text-2xl font-bold">Insights</h1>
    <Button variant="default">Create Insight</Button>
  </div>

  <table id="igrid" class="display w-full">
    <thead>
    <tr>
      <th>Name</th>
      <th>Created At</th>
      <th>Updated At</th>
    </tr>
    </thead>
    <tbody>
    {#each data as row}
      <tr>
        <td>
          <a class="font-bold hover:underline" href="/app/insight/{row.id}">
            {row.name}
          </a>
        </td>
        <td>{moment(row.createdAt).fromNow()}</td>
        <td>{moment(row.updatedAt).fromNow()}</td>
      </tr>
    {/each}
    </tbody>
  </table>
</div>

<!--<style>-->
<!--    :global(.dataTables_wrapper) {-->
<!--        @apply font-sans;-->
<!--    }-->

<!--    :global(.dataTables_filter),-->
<!--    :global(.dataTables_length) {-->
<!--        @apply mb-4;-->
<!--    }-->

<!--    :global(.dataTables_info),-->
<!--    :global(.dataTables_paginate) {-->
<!--        @apply mt-4;-->
<!--    }-->

<!--    :global(.dataTables_paginate) {-->
<!--        @apply flex gap-2;-->
<!--    }-->

<!--    :global(.paginate_button) {-->
<!--        @apply px-3 py-1 rounded border border-gray-200 hover:bg-gray-100 cursor-pointer;-->
<!--    }-->

<!--    :global(.paginate_button.current) {-->
<!--        @apply bg-primary text-white border-primary;-->
<!--    }-->

<!--    table {-->
<!--        @apply w-full border-collapse;-->
<!--    }-->

<!--    th {-->
<!--        @apply px-4 py-2 text-left bg-gray-50 font-medium text-gray-700;-->
<!--    }-->

<!--    td {-->
<!--        @apply px-4 py-2 border-t border-gray-100;-->
<!--    }-->

<!--    tr:hover td {-->
<!--        @apply bg-gray-50;-->
<!--    }-->

<!--    :global(.dt-search) {-->
<!--        @apply mb-2;-->
<!--    }-->
<!--    :global(.dt-search input) {-->
<!--        @apply p-1 ml-1 border border-gray-400 rounded-md;-->
<!--    }-->
<!--</style>-->
