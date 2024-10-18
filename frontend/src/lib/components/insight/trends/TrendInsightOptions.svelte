<script lang="ts">
    import { createEventDispatcher } from 'svelte'
    import type { TrendInsight } from '$lib/components/insight/trends/TrendInsight'

    export let insight: TrendInsight
    const dispatcher = createEventDispatcher()
</script>

<div class="flex">
  {insight.id}
</div>
