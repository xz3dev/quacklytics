import type { ReactNode } from "react";
import { formatDistanceStrict } from "date-fns";
import {
  AlertTriangle,
  CircleCheck,
  CircleDashed,
  CircleX,
  KeyRound,
  ShieldX,
} from "lucide-react";
import type { ProjectSetup } from "@quacklytics/contracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/tailwind";
import type { Project } from "@/model/project";
import { useUpdateProjectCorsOrigins } from "@/services/projects";
import {
  PROXY_ISSUES,
  ProxyFacts,
  ProxyFixSteps,
} from "@/app/proxy-check/proxy-check-gate";

type CheckState = "pass" | "warn" | "fail" | "pending";
interface Check {
  id: string;
  state: CheckState;
  title: string;
  detail: ReactNode;
}

const ago = (at: number) =>
  Date.now() - at < 10_000
    ? "just now"
    : formatDistanceStrict(at, Date.now(), { addSuffix: true });

/** Turns what the server recorded about the latest event into a checklist. */
function setupChecks(
  setup: ProjectSetup & {
    latestEvent: NonNullable<ProjectSetup["latestEvent"]>;
  },
): Check[] {
  const { latestEvent: event, lastIngest } = setup;
  const checks: Check[] = [
    {
      id: "received",
      state: "pass",
      title: "Event received",
      detail: (
        <>
          <code>{event.eventType}</code> at{" "}
          {new Date(event.timestamp).toLocaleTimeString()}
        </>
      ),
    },
    {
      id: "client",
      state: "pass",
      title: event.sdk
        ? `Sent with ${event.sdk.name} ${event.sdk.version}`
        : "Sent over the HTTP API",
      detail: "The ingestion key was accepted.",
    },
  ];
  if (lastIngest?.rejected)
    checks.push({
      id: "archived",
      state: "fail",
      title: `${lastIngest.rejected} event${lastIngest.rejected === 1 ? " was" : "s were"} dropped`,
      detail:
        "Their timestamps fall in an archived month. Import historical events through /api/backfill instead.",
    });
  checks.push(
    event.personId || event.sessionId
      ? {
          id: "identity",
          state: "pass",
          title: "Visitor identified",
          detail: (
            <>
              Attributed to{" "}
              <code>{event.personId ?? "an anonymous visitor"}</code>
              {event.sessionId ? " with a session" : ""}.
            </>
          ),
        }
      : {
          id: "identity",
          state: "warn",
          title: "No visitor attached",
          detail: (
            <>
              This event counts toward totals, but not toward visitors or
              sessions. Send a <code>personId</code> such as{" "}
              <code>user:&lt;id&gt;</code>, or use an SDK.
            </>
          ),
        },
  );
  if (!lastIngest)
    checks.push({
      id: "address",
      state: "pending",
      title: "Visitor address not checked yet",
      detail:
        "The server restarted since this event arrived. Send another event to check it.",
    });
  else if (
    lastIngest.proxy.status === "direct" ||
    lastIngest.proxy.status === "ok"
  )
    checks.push({
      id: "address",
      state: "pass",
      title: "Real visitor address visible",
      detail: (
        <>
          The server sees <code>{lastIngest.proxy.clientIp}</code>
          {lastIngest.proxy.status === "ok"
            ? ", forwarded by your trusted proxy."
            : ", connecting directly."}
        </>
      ),
    });
  else {
    const proxy = lastIngest.proxy;
    const issue = PROXY_ISSUES[lastIngest.proxy.status];
    checks.push({
      id: "address",
      state: "fail",
      title: issue.title,
      detail: (
        <div className="flex flex-col gap-4">
          <p>{issue.body}</p>
          <ProxyFacts result={proxy} clientLabel="Sender address" />
          <ProxyFixSteps
            result={proxy}
            retestHint="Send another event. This check updates by itself."
          />
        </div>
      ),
    });
  }
  if (lastIngest?.origin)
    checks.push({
      id: "origin",
      state: "pass",
      title: "Browser origin allowed",
      detail: (
        <>
          Requests from <code>{lastIngest.origin}</code> are accepted.
        </>
      ),
    });
  return checks;
}

export function EventMonitor({
  project,
  setup,
}: {
  project: Project;
  setup: ProjectSetup | undefined;
}) {
  return (
    <section
      aria-labelledby="event-monitor-heading"
      className="flex flex-col gap-4"
    >
      <SetupHints project={project} setup={setup} />
      {setup?.latestEvent ? (
        <Verification setup={{ ...setup, latestEvent: setup.latestEvent }} />
      ) : (
        <Waiting />
      )}
    </section>
  );
}

function Waiting() {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-card/60 px-6 py-10 text-center"
    >
      <span className="relative flex size-12 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-primary/20 motion-safe:animate-ping" />
        <span className="absolute inset-2 rounded-full bg-primary/30 motion-safe:animate-ping [animation-delay:400ms]" />
        <span className="relative size-3 rounded-full bg-primary" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 id="event-monitor-heading" className="font-medium">
          Waiting for your first event…
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Send one using any of the options above. This page checks it as soon
          as it arrives.
        </p>
      </div>
    </div>
  );
}

function Verification({
  setup,
}: {
  setup: ProjectSetup & {
    latestEvent: NonNullable<ProjectSetup["latestEvent"]>;
  };
}) {
  const checks = setupChecks(setup);
  const failing = checks.some((check) => check.state === "fail");
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 motion-safe:duration-500 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95">
      <header className="flex flex-col gap-1">
        <h2 id="event-monitor-heading" className="text-lg font-semibold">
          {failing
            ? "Events arrive, but something needs attention"
            : "You're all set"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {failing
            ? "Fix the items marked below. The checks rerun with every event you send."
            : "Your first event arrived and everything checks out."}
        </p>
      </header>
      <ul aria-label="Setup checks" className="flex flex-col divide-y">
        {checks.map((check, index) => (
          <li
            key={check.id}
            data-state={check.state}
            className="flex gap-3 py-3 first:pt-0 last:pb-0 motion-safe:duration-300 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2 motion-safe:fill-mode-both"
            style={{ animationDelay: `${150 + index * 120}ms` }}
          >
            <CheckIcon state={check.state} />
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">{check.title}</span>
              <div className="text-muted-foreground">{check.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckIcon({ state }: { state: CheckState }) {
  const className = "mt-0.5 size-5 shrink-0";
  if (state === "pass")
    return (
      <CircleCheck
        aria-label="Passed"
        className={cn(className, "text-emerald-500")}
      />
    );
  if (state === "warn")
    return (
      <AlertTriangle
        aria-label="Warning"
        className={cn(className, "text-amber-500")}
      />
    );
  if (state === "fail")
    return (
      <CircleX
        aria-label="Failed"
        className={cn(className, "text-destructive")}
      />
    );
  return (
    <CircleDashed
      aria-label="Pending"
      className={cn(className, "text-muted-foreground")}
    />
  );
}

/** Problems seen before any event could be stored, with a fix where possible. */
function SetupHints({
  project,
  setup,
}: {
  project: Project;
  setup: ProjectSetup | undefined;
}) {
  const updater = useUpdateProjectCorsOrigins();
  if (!setup) return null;
  const { rejectedOrigins, lastIngest } = setup;
  // A later accepted request means the right key is in use now.
  const invalidKeyAt =
    setup.invalidKeyAt !== null &&
    (!lastIngest || setup.invalidKeyAt > lastIngest.receivedAt)
      ? setup.invalidKeyAt
      : null;
  if (!rejectedOrigins.length && invalidKeyAt === null) return null;
  return (
    <ul aria-label="Setup problems" className="flex flex-col gap-2">
      {rejectedOrigins.map(({ origin, at }) => (
        <Hint key={origin} icon={<ShieldX />}>
          <span className="min-w-0 flex-1">
            Blocked a browser request from <code>{origin}</code> {ago(at)}. It
            is not an allowed origin.
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={updater.isPending}
            onClick={() => {
              updater.mutate({
                projectId: project.id,
                value: JSON.stringify([...project.corsOrigins, origin]),
              });
            }}
          >
            Allow {origin}
          </Button>
        </Hint>
      ))}
      {invalidKeyAt !== null && (
        <Hint icon={<KeyRound />}>
          <span className="min-w-0 flex-1">
            A request used an unknown ingestion key {ago(invalidKeyAt)}. Copy
            the key from the snippets above.
          </span>
        </Hint>
      )}
    </ul>
  );
}

function Hint({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 motion-safe:animate-in motion-safe:fade-in dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200 [&>svg]:size-4 [&>svg]:shrink-0">
      {icon}
      {children}
    </li>
  );
}
