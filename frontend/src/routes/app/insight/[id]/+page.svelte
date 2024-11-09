<script lang="ts">
    import { page } from '$app/stores'
    import { insightsStore } from '$lib/client/insights'
    import InsightView from '$lib/components/insight/InsightView.svelte'
    import type { Insight } from '$lib/components/insight/Insight'

    const id = parseInt($page.params.id)

    const insights = $insightsStore

    $: insight = insights.find(i => i.id === id)
    $: console.log(insights.find(i => i.id == id))
    $: console.log(id)
</script>
<InsightView bind:insight />
