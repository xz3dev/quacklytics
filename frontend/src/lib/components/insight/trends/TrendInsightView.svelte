<script lang="ts">
import {
    type TrendInsight,
    type TrendSeriesType,
    fetchData,
} from '$lib/components/insight/trends/TrendInsight'
import TrendInsightOptions from '$lib/components/insight/trends/TrendInsightOptions.svelte'
import Chart, { type ChartDataset } from 'chart.js/auto'
import { getContext, onDestroy, onMount, setContext } from 'svelte'
import { type Writable, derived, writable } from 'svelte/store'
import 'chartjs-adapter-moment'

import { insightColor } from '$lib/components/insight/Insight'
import type { InsightMeta } from '$lib/components/insight/meta/InsightMeta'
import InsightMetaContainer from '$lib/components/insight/meta/InsightMetaContainer.svelte'
import InsightMetaView from '$lib/components/insight/meta/InsightMetaView.svelte'
import type { Selected } from 'bits-ui'
import {
    Legend,
    LineElement,
    LinearScale,
    TimeScale,
    Title,
    Tooltip,
} from 'chart.js'

Chart.register(TimeScale, LinearScale, LineElement, Title, Tooltip, Legend)

let chartInstance: Chart | null = null

const insightStore = getContext<Writable<TrendInsight>>('insight')
const insightMetaStore = getContext<Writable<InsightMeta>>('insightMeta')

const createDataset = (
    type: 'line' | 'bar',
    label: string,
    data: any[],
    index: number,
) =>
    ({
        type,
        label,
        data,
        borderColor: insightColor(index),
        backgroundColor: insightColor(index),
        tension: 0.1,
    }) satisfies ChartDataset

let unsubscribe: () => void

onMount(async () => {
    const ctx = document.getElementById('eventChart') as HTMLCanvasElement
    chartInstance = new Chart(ctx, {
        data: {
            labels: [],
            datasets: [createDataset('line', 'Events', [], 0)],
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

    const insightData = derived(
        [insightMetaStore, insightStore],
        ([meta, insight]) => {
            return fetchData(insight, meta)
        },
    )

    unsubscribe = insightData.subscribe(async (dataP) => {
        const data = await dataP
        if (chartInstance && data && data.length > 0) {
            chartInstance.data.datasets = []
            const labels = data[0].map((r) => new Date(r.bucket_0))
            chartInstance.data.labels = labels
            for (const [index, series] of data.entries()) {
                const type = $insightStore.series?.[index]?.type ?? 'line'
                if (!chartInstance.data.datasets[index]) {
                    chartInstance.data.datasets[index] = createDataset(
                        type,
                        `Series ${index}`,
                        series.map((r) => Number(r.result_value)),
                        index,
                    )
                }
            }
            chartInstance.update()
        }
    })
})

onDestroy(() => unsubscribe())

$: if (chartInstance?.options.scales?.x)
    chartInstance.options.scales.x.min = $insightMetaStore.range.start.getTime()
$: if (chartInstance?.options.scales?.x)
    chartInstance.options.scales.x.max = $insightMetaStore.range.end.getTime()
</script>
<div class="flex items-center gap-2 mb-4">
    <InsightMetaView />
    <!-- dropdown to select bar type -->
</div>
<TrendInsightOptions/>

<div class="w-full h-[400px]">
    <canvas id="eventChart"></canvas>
</div>
