import { useProjectId } from "@/hooks/use-project-id";
import { Link } from "@/lib/navigation";

export function ProjectLink({
  children,
  to,
}: {
  children: React.ReactNode;
  to: string;
}) {
  const projectId = useProjectId();
  const linkWithoutLeadingSlash = to.startsWith("/") ? to.slice(1) : to;
  const destination: string = `/app/${projectId}/${linkWithoutLeadingSlash}`;
  return <Link to={destination}>{children}</Link>;
}
