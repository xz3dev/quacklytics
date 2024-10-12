<script lang="ts">
    import { onMount } from 'svelte';
    import Chart from 'chart.js/auto';
    import { dbManager } from '$lib/duck-db-manager';
    import { type AggregationOperation, buildInsightQuery, type TimeframeMode } from '$lib/local-queries'

    let eventTypes = ['All', 'PageView', 'Click', 'Purchase']; // Add your actual event types
    let aggregationOperations = [
        'TotalCount',
        'UniqueUsers',
        'CountPerUserAvg',
        'CountPerUserMin',
        'CountPerUserMax',
        'Sum',
        'Average'
    ];
    let timeframeModes = ['Daily', 'Weekly', 'Monthly'];
    let selectedEventType = 'All';
    let selectedOperation: AggregationOperation = 'TotalCount';
    let selectedTimeframe: TimeframeMode = 'Daily';
    let selectedField = '';
    let startDate = '';
    let endDate = '';
    let chartInstance: Chart | null = null;

    $: showFieldInput = ['Sum', 'Average'].includes(selectedOperation);

    onMount(() => {
        const ctx = document.getElementById('eventChart') as HTMLCanvasElement;
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Events',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    });

    async function fetchData() {
        const query = buildInsightQuery({
            eventType: selectedEventType !== 'All' ? selectedEventType : undefined,
            aggregation: {
                operation: selectedOperation,
                field: selectedField
            },
            timeframe: selectedTimeframe,
            startDate,
            endDate
        });

        const results = await dbManager.runQuery(query);

        if (chartInstance && results) {
            chartInstance.data.labels = results.map(r => r.timestamp);
            chartInstance.data.datasets[0].data = results.map(r => r.value);
            chartInstance.update();
        }
    }
</script>

<div class="p-4">
    <h1 class="text-3xl font-bold mb-4">Insight</h1>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div class="form-control w-full">
            <label class="label" for="eventType">
                <span class="label-text">Event Type</span>
            </label>
            <select bind:value={selectedEventType} id="eventType" class="select select-bordered w-full">
                {#each eventTypes as eventType}
                    <option value={eventType}>{eventType}</option>
                {/each}
            </select>
        </div>

        <div class="form-control w-full">
            <label class="label" for="operation">
                <span class="label-text">Aggregation Operation</span>
            </label>
            <select bind:value={selectedOperation} id="operation" class="select select-bordered w-full">
                {#each aggregationOperations as operation}
                    <option value={operation}>{operation}</option>
                {/each}
            </select>
        </div>

        {#if showFieldInput}
            <div class="form-control w-full">
                <label class="label" for="field">
                    <span class="label-text">Field</span>
                </label>
                <input bind:value={selectedField} type="text" id="field" placeholder="Enter field name" class="input input-bordered w-full" />
            </div>
        {/if}

        <div class="form-control w-full">
            <label class="label" for="timeframe">
                <span class="label-text">Timeframe</span>
            </label>
            <select bind:value={selectedTimeframe} id="timeframe" class="select select-bordered w-full">
                {#each timeframeModes as mode}
                    <option value={mode}>{mode}</option>
                {/each}
            </select>
        </div>

        <div class="form-control w-full">
            <label class="label" for="startDate">
                <span class="label-text">Start Date</span>
            </label>
            <input bind:value={startDate} type="date" id="startDate" class="input input-bordered w-full" />
        </div>

        <div class="form-control w-full">
            <label class="label" for="endDate">
                <span class="label-text">End Date</span>
            </label>
            <input bind:value={endDate} type="date" id="endDate" class="input input-bordered w-full" />
        </div>
    </div>

    <button class="btn btn-primary mb-4" on:click={fetchData}>Apply Filters</button>

    <div class="w-full h-[400px]">
        <canvas id="eventChart"></canvas>
    </div>
</div>
