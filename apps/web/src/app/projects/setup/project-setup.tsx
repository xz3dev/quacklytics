import { ArrowRight, Check } from "lucide-react";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { useProject, useProjectId } from "@/hooks/use-project-id";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils/tailwind";
import { useProjectSetup } from "@/services/project-setup";
import { useProjects } from "@/services/projects";
import { ProjectsShell } from "../projects-shell";
import { EventMonitor } from "./event-monitor";
import { IngestionKey } from "./ingestion-key";
import { SendData } from "./send-data";

export function ProjectSetup() {
  return (
    <ProjectsShell>
      <SetupFlow />
    </ProjectsShell>
  );
}

function SetupFlow() {
  const projectId = useProjectId();
  const projects = useProjects();
  const project = useProject();
  const setup = useProjectSetup(projectId);
  if (projects.isPending) return <Spinner />;
  if (!project)
    return (
      <p role="alert" className="text-sm text-destructive">
        {projects.error?.message ?? "Project not found."}
      </p>
    );
  const received = !!setup.data?.latestEvent;
  const host = window.location.origin;
  return (
    <div className="flex flex-col gap-8 motion-safe:duration-500 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-8">
      <header className="flex flex-col gap-4">
        <Stepper received={received} />
        <h1 className="text-2xl font-semibold tracking-tight">
          Send your first event to {project.name}
        </h1>
      </header>

      <IngestionKey projectId={projectId} autoCreate>
        {(apiKey) => <SendData project={project} apiKey={apiKey} host={host} />}
      </IngestionKey>

      <EventMonitor project={project} setup={setup.data} />

      <footer className="flex items-center justify-end gap-2 border-t border-border/50 pt-6">
        {!received && (
          <Button asChild variant="ghost">
            <Link to="/app/$projectid" params={{ projectid: projectId }}>
              Skip for now
            </Link>
          </Button>
        )}
        <Button asChild variant={received ? "default" : "secondary"}>
          <Link to="/app/$projectid" params={{ projectid: projectId }}>
            Open project
            <ArrowRight />
          </Link>
        </Button>
      </footer>
    </div>
  );
}

function Stepper({ received }: { received: boolean }) {
  const steps = [
    { label: "Name", done: true },
    { label: "Send data", done: received },
    { label: "Verify", done: false, active: received },
  ];
  return (
    <ol aria-label="Setup progress" className="flex items-center gap-2 text-xs">
      {steps.map((step, index) => {
        const current = !step.done && (step.active ?? steps[index - 1]?.done);
        return (
          <li
            key={step.label}
            aria-current={current ? "step" : undefined}
            className="flex items-center gap-2"
          >
            {index > 0 && (
              <span
                className={cn(
                  "h-px w-6 transition-colors duration-500",
                  steps[index - 1]?.done ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors duration-500",
                step.done &&
                  "border-primary bg-primary text-primary-foreground",
                current && "border-primary text-foreground",
              )}
            >
              {step.done ? (
                <Check className="size-3" strokeWidth={3} />
              ) : (
                index + 1
              )}
            </span>
            <span
              className={cn(
                step.done || current
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
