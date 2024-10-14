<script lang="ts">
    import { onMount } from 'svelte';
    import Chart from 'chart.js/auto';
    import type { AggregationFunction } from '$lib/local-queries'
    import { buildQuery, type Query, type Field, type Filter, type Aggregation } from '$lib/local-queries';
    import { dbManager } from '$lib/globals'

    let eventTypes = ['test_type']; // Add your actual event types
    let aggregationFunctions: AggregationFunction[] = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];
    let timeframeModes = ['Daily', 'Weekly', 'Monthly'];
    let selectedEventType = 'test_type';
    let selectedAggregationFunction = 'COUNT';
    let selectedTimeframe = 'Daily';
    let fieldVariable = ''; // Specify which field or property to operate on
    let startDate = '';
    let endDate = '';
    let chartInstance: Chart | null = null;

    $: showFieldInput = ['SUM', 'AVG', 'MIN', 'MAX'].includes(selectedAggregationFunction);

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
                    x: {
                        ticks: {
                            autoSkip: true,
                            maxRotation: 0,
                            maxTicksLimit: 10 // Adjust this value to control the maximum number of ticks
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    });

    async function fetchData() {
        const aggregationField: Field = {
            name: fieldVariable,
        };

        const aggregations: Aggregation[] = [{
            function: selectedAggregationFunction as 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX',
            field: aggregationField,
            alias: 'result_value'
        }];

        let filters: Filter[] = [];
        if (selectedEventType !== 'All') {
            filters.push({
                field: { name: 'event_type' },
                operator: '=',
                value: selectedEventType
            });
        }
        if (startDate) {
            filters.push({
                field: { name: 'timestamp' },
                operator: '>=',
                value: startDate
            });
        }
        if (endDate) {
            filters.push({
                field: { name: 'timestamp' },
                operator: '<=',
                value: endDate
            });
        }

        const groupBy: Field[] = [{ name: getGroupByField(selectedTimeframe) }];

        const query: Query = {
            aggregations,
            filters,
            groupBy
        };

        const { sql, params } = buildQuery(query);

        console.log(sql, ...params)
        const results = await dbManager.runQuery(sql, ...params);
        if (chartInstance && results) {
            chartInstance.data.labels = results.map(r => r.bucket_0);
            chartInstance.data.datasets[0].data = results.map(r => Number(r.result_value));
            chartInstance.update();
        }
    }

    function getGroupByField(timeframe: string): string {
        if (timeframe === 'Daily') return "date_trunc('day', timestamp)";
        if (timeframe === 'Weekly') return "date_trunc('week', timestamp)";
        return "date_trunc('month', timestamp)";
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
            <label class="label" for="aggregationFunction">
                <span class="label-text">Aggregation Function</span>
            </label>
            <select bind:value={selectedAggregationFunction} id="aggregationFunction" class="select select-bordered w-full">
                {#each aggregationFunctions as func}
                    <option value={func}>{func}</option>
                {/each}
            </select>
        </div>

        {#if showFieldInput}
            <div class="form-control w-full">
                <label class="label" for="fieldVariable">
                    <span class="label-text">Field / Property</span>
                </label>
                <input bind:value={fieldVariable} type="text" id="fieldVariable" placeholder="Enter field name" class="input input-bordered w-full" />
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

    <button class="btn btn-neutral mb-4" on:click={fetchData}>Apply Filters</button>

    <div class="w-full h-[400px]">
        <canvas id="eventChart"></canvas>
    </div>
</div>
