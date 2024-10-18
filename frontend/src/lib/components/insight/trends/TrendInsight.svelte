<script lang="ts">
    import { onMount } from 'svelte'
    import Chart from 'chart.js/auto'
    import { TrendInsight } from '$lib/components/insight/trends/TrendInsight'
    import TrendInsightOptions from '$lib/components/insight/trends/TrendInsightOptions.svelte'

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
                scales: {
                    x: {
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

        const data = await insight.fetchData()
        console.log(data)
        if (chartInstance && data) {
            const labels = data[0].map(r => r.bucket_0)
            chartInstance.data.labels = labels
            for (const [index, series] of data.entries()) {
                chartInstance.data.datasets[index].data = series.map(r => Number(r.result_value))
            }
            chartInstance.update()
        }
    })
</script>

<TrendInsightOptions {insight} />

<div class="w-full h-[400px]">
  <canvas id="eventChart"></canvas>
</div>
