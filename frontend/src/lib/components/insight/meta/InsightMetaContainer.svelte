<script lang="ts">
import { createInsightMetaStore } from '$lib/components/insight/meta/InsightMeta'
import { getLocalTimeZone, now } from '@internationalized/date'
import { setContext } from 'svelte'

const store = createInsightMetaStore({
    range: {
        start: now(getLocalTimeZone()).subtract({ days: 30 }).toDate(),
        end: now(getLocalTimeZone()).toDate(),
    },
    timeBucket: 'Daily',
})
setContext('insightMeta', store)
</script>
<slot/>
