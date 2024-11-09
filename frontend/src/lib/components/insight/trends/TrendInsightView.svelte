<script lang="ts">
    import { getContext, onMount, setContext } from 'svelte'
    import Chart, { type ChartDataset } from 'chart.js/auto'
    import { fetchData, type TrendInsight } from '$lib/components/insight/trends/TrendInsight'
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
    import type { InsightMeta } from '$lib/components/insight/meta/InsightMeta'
    import { insightColor } from '$lib/components/insight/Insight'

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

    const createDataset = (label: string, data: any[], index: number) => ({
        label,
        data,
        borderColor: insightColor(index),
        tension: 0.1,
    }) satisfies ChartDataset

    onMount(async () => {
        const ctx = document.getElementById('eventChart') as HTMLCanvasElement
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    createDataset('Events', [], 0),
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        text: $insightStore.id.toString(),
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

        const insightData = derived([insightMetaStore, insightStore], ([meta, insight]) => {
            console.log(meta, insight, 'data')
            return fetchData(insight, meta)
        })

        insightData.subscribe(async dataP => {
            const data = await dataP
            if (chartInstance && data) {
                const labels = data[0].map(r => new Date(r.bucket_0))
                console.log(labels)
                chartInstance.data.labels = labels
                for (const [index, series] of data.entries()) {
                    if(!chartInstance.data.datasets[index]) {
                        chartInstance.data.datasets[index] = createDataset(`Series ${index}`, series.map(r => Number(r.result_value)), index)
                    }
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
