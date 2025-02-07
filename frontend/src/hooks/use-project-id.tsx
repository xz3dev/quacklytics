import {useParams} from "react-router"

export function useProjectId() {
    const {projectid} = useParams()
    if (!projectid) throw new Error('Project ID not found in URL')
    return projectid
}
