<script lang="ts">
    import { onMount, setContext } from 'svelte'
    import Chart from 'chart.js/auto'
    import { TrendInsight } from '$lib/components/insight/trends/TrendInsight'
    import TrendInsightOptions from '$lib/components/insight/trends/TrendInsightOptions.svelte'
    import { writable } from 'svelte/store'
    import 'chartjs-adapter-moment';

    import {
        TimeScale,
        LinearScale,
        LineElement,
        Title,
        Tooltip,
        Legend,
    } from 'chart.js'
    import InsightMeta from '$lib/components/insight/InsightMeta.svelte'

    Chart.register(
        TimeScale,
        LinearScale,
        LineElement,
        Title,
        Tooltip,
        Legend,
    )


    let chartInstance: Chart | null = null

    const insight = new TrendInsight()
    insight.series = [
        {
            name: 'Event Count',
            filters: [
                {
                    field: { name: 'event_type' },
                    operator: '=',
                    value: 'test_type',
                },
            ],
            aggregations: [
                {
                    function: 'COUNT',
                    field: { name: 'event_type' },
                    alias: 'result_value',
                },
            ],
        },
    ]


    const insightStore = writable(insight)
    setContext('insight', insightStore)

    onMount(async () => {
        const ctx = document.getElementById('eventChart') as HTMLCanvasElement
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Events',
                    data: [],
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        text: insight.id,
                        display: true
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            tooltipFormat: 'dd T'
                        },
                        title: {
                            display: true,
                            text: 'Date'
                        },
                        ticks: {
                            autoSkip: true,
                            maxRotation: 0,
                            maxTicksLimit: 10, // Adjust this value to control the maximum number of ticks
                        },
                    },
                    y: {
                        beginAtZero: true,
                    },
                },
            },
        })

        insightStore.subscribe(async insight => {
            const data = await insight.fetchData()
            if (chartInstance && data) {
                const labels = data[0].map(r => new Date(r.bucket_0))
                console.log(labels)
                chartInstance.data.labels = labels
                for (const [index, series] of data.entries()) {
                    chartInstance.data.datasets[index].data = series.map(r => Number(r.result_value))
                }
                chartInstance.update()
            }
        })
    })
</script>

<div class="flex flex-row items-center mr-2">
  <InsightMeta />
</div>

<TrendInsightOptions />

<div class="w-full h-[400px]">
  <canvas id="eventChart"></canvas>
</div>
