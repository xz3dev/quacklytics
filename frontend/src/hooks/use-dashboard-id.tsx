import {useParams} from "react-router"

export function useDashboardId() {
    const {dashboardid} = useParams()
    const dashboardIdAsNumber = dashboardid ? parseInt(dashboardid) : undefined
    if (!dashboardIdAsNumber || isNaN(dashboardIdAsNumber)) throw new Error('Dashboard ID illegal or missing.')
    return dashboardIdAsNumber
}
