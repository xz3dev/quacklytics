<script>
    import TrendInsight from '$lib/components/insight/trends/TrendInsight.svelte'
    import {Button} from '$lib/components/ui/button/index'
    import {AnalyticsClient} from '$lib/client/client'

    const fetchData = async () => {
        const client = new AnalyticsClient()
        const insights = await client.getInsights()
        console.log(insights)
    }
</script>

<Button on:click={fetchData}>Fetch Data</Button>

<TrendInsight />
