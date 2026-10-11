import { useEffect, useRef, type ReactNode } from "react";
import { Spinner } from "@/components/spinner";
import { Button } from "@/components/ui/button";
import { useApiKey, useApiKeys, useCreateApiKey } from "@/services/apikeys";

/**
 * Supplies the newest key's full value. With `autoCreate`, a project without
 * keys gets one; otherwise the user is asked to create one.
 */
export function IngestionKey({
  projectId,
  autoCreate = false,
  children,
}: {
  projectId: string;
  autoCreate?: boolean;
  children: (apiKey: string) => ReactNode;
}) {
  const keys = useApiKeys(projectId);
  const create = useCreateApiKey(projectId);
  const newest = keys.data?.reduce<(typeof keys.data)[number] | undefined>(
    (latest, key) => (!latest || key.id > latest.id ? key : latest),
    undefined,
  );
  // New projects come with a key; older ones, or one whose keys were all
  // deleted, get one here. The ref keeps Strict Mode from creating two.
  const missing = keys.isSuccess && !newest;
  const shouldCreate = autoCreate && missing;
  const requested = useRef(false);
  useEffect(() => {
    if (!shouldCreate || requested.current) return;
    requested.current = true;
    create.mutate();
  }, [shouldCreate, create]);
  // A key created moments ago already carries its value; older ones are read.
  const known = newest && !newest.key.endsWith("…") ? newest.key : undefined;
  const full = useApiKey(projectId, newest?.id ?? 0, {
    enabled: !!newest && !known,
    retry: false,
  });
  const apiKey = known ?? full.data?.key;
  if (apiKey) return <>{children(apiKey)}</>;
  const error = keys.error ?? create.error ?? full.error;
  if (missing && !autoCreate)
    return (
      <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
        Create an ingestion key to see code examples for this project.
      </p>
    );
  if (!error) return <Spinner />;
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border bg-card p-5 text-sm">
      <p role="alert" className="text-destructive">
        Loading the ingestion key failed: {error.message}
      </p>
      <Button
        variant="secondary"
        onClick={() => {
          if (create.isError) create.mutate();
          else void (keys.isError ? keys.refetch() : full.refetch());
        }}
      >
        Try again
      </Button>
    </div>
  );
}
