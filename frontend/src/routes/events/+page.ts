import type { PageLoad } from './$types'
import { dbManager } from '$lib/db-manager'

export const ssr = false
export const csr = true

export const load: PageLoad = async ({ params }) => {
    const events = await dbManager.loadRecentData()
    return {
        events,
    }
}
