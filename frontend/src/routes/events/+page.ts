import type { PageLoad } from './$types'

export const ssr = false
export const csr = true

export const load: PageLoad = async ({ params }) => {
    return {}
}
