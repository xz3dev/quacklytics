import { Button } from "@/components/ui/button"; // using a ShadCN button component
import { useApiKeys, useCreateApiKey } from "@/services/apikeys.ts";
import { useProjectId } from "@/hooks/use-project-id";
import { ApiKeyRow } from "@app/apikeys/api-key-row.tsx";

export function ApikeyManagement() {
  // Initially load the list of ingestion keys without the actual key value.
  const projectId = useProjectId();
  const { data: apiKeys, isLoading, error } = useApiKeys(projectId);
  const createMutation = useCreateApiKey(projectId);

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync();
    } catch (error) {
      console.error("Failed to create ingestion key:", error);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/50 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Ingestion keys</h2>
        <Button onClick={handleCreate}>{"Create ingestion key"}</Button>
      </div>
      {isLoading ? (
        <div>Loading ingestion keys...</div>
      ) : error ? (
        <div>Error loading ingestion keys.</div>
      ) : !apiKeys || apiKeys.length === 0 ? (
        <div className="p-4 text-center">No ingestion keys found.</div>
      ) : (
        apiKeys.map((apiKey) => (
          <ApiKeyRow key={apiKey.id} projectId={projectId} apiKey={apiKey} />
        ))
      )}
    </div>
  );
}
