<script lang="ts">
    import InsightMetaView from '$lib/components/insight/meta/InsightMetaView.svelte'
    import TrendInsightView from '$lib/components/insight/trends/TrendInsightView.svelte'
    import { writable } from 'svelte/store'
    import { setContext } from 'svelte'
    import { TrendInsight } from '$lib/components/insight/trends/TrendInsight'

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
</script>

<InsightMetaView>
  <TrendInsightView />
</InsightMetaView>
