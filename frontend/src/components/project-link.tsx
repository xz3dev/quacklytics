import { useProjectId } from "@/hooks/use-project-id";
import {Link} from "react-router";

export function ProjectLink({children, to}: { children: React.ReactNode, to: string }) {
    const projectId = useProjectId()
    const linkWithoutLeadingSlash = to.startsWith('/') ? to.slice(1) : to
    return (
        <Link to={`/app/${projectId}/${linkWithoutLeadingSlash}`}>
            {children}
        </Link>
    )
}
