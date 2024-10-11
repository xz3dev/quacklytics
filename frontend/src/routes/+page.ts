import type { PageLoad } from '../../.svelte-kit/types/src/routes/events/$types'
import { dbManager } from '$lib/duck-db-manager'

export const ssr = false
export const csr = true

export const load: PageLoad = ({ params }) => {
}
