<script lang="ts">
    import { getContext, onMount, setContext } from 'svelte'
    import Chart from 'chart.js/auto'
    import { TrendInsight } from '$lib/components/insight/trends/TrendInsight'
    import TrendInsightOptions from '$lib/components/insight/trends/TrendInsightOptions.svelte'
    import { derived, type Writable, writable } from 'svelte/store'
    import 'chartjs-adapter-moment'

    import {
        TimeScale,
        LinearScale,
        LineElement,
        Title,
        Tooltip,
        Legend,
    } from 'chart.js'
    import type { InsightMeta } from '$lib/components/insight/InsightMeta'

    Chart.register(
        TimeScale,
        LinearScale,
        LineElement,
        Title,
        Tooltip,
        Legend,
    )


    let chartInstance: Chart | null = null

    const insightStore = getContext<Writable<TrendInsight>>('insight')
    const insightMetaStore = getContext<Writable<InsightMeta>>('insightMeta')

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
                        text: $insightStore.id,
                        display: true,
                    },
                },
                scales: {
                    x: {
                        type: 'time',
                        min: $insightMetaStore.range.start.getTime(),
                        max: $insightMetaStore.range.end.getTime(),
                        time: {
                            tooltipFormat: 'L',
                        },
                        title: {
                            display: true,
                            text: 'Date',
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

        const insightData = derived([insightMetaStore, insightStore], ([meta, insight]) => insight.fetchData(meta))

        insightData.subscribe(async dataP => {
            const data = await dataP
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
    $: if (chartInstance?.options.scales?.x) chartInstance.options.scales.x.min = $insightMetaStore.range.start.getTime()
    $: if (chartInstance?.options.scales?.x) chartInstance.options.scales.x.max = $insightMetaStore.range.end.getTime()
</script>

<TrendInsightOptions />

<div class="w-full h-[400px]">
  <canvas id="eventChart"></canvas>
</div>
