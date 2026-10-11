import { ApiKey, useApiKey, useDeleteApiKey } from "@/services/apikeys.ts";
import React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button.tsx";
import { Eye, EyeOff, Copy, Trash2 } from "lucide-react";
import { cn } from "@lib/utils/tailwind.ts";
import { toast } from "sonner";

interface ApiKeyRowProps {
  projectId: string;
  apiKey: ApiKey;
}

export function ApiKeyRow({ projectId, apiKey }: ApiKeyRowProps) {
  // Disable automatic fetching until the ingestion key is requested.
  const { data, refetch, isFetching, error } = useApiKey(projectId, apiKey.id, {
    enabled: false,
  });

  const [isKeyVisible, setIsKeyVisible] = React.useState(false);
  const deleteMutation = useDeleteApiKey(projectId);

  const handleToggleKey = async () => {
    if (isKeyVisible) {
      setIsKeyVisible(false);
    } else {
      void refetch();
      setIsKeyVisible(true);
    }
  };

  // Copying works on a hidden key too: the full value is fetched first.
  const handleCopy = async () => {
    const key = data?.key ?? (await refetch()).data?.key;
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
      toast.success("Ingestion key copied to clipboard");
    } catch (error) {
      console.error("Failed to copy ingestion key:", error);
      toast.error("Failed to copy ingestion key");
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this ingestion key?",
    );
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(apiKey.id);
    } catch (error) {
      console.error("Failed to delete ingestion key:", error);
    }
  };

  const revealed =
    isKeyVisible && !isFetching && !error ? data?.key : undefined;
  // Masked keys keep their prefix so several keys stay distinguishable.
  const displayValue = revealed
    ? revealed
    : isKeyVisible && isFetching
      ? "Loading…"
      : `${apiKey.key.slice(0, 8)}${"•".repeat(24)}`;

  return (
    <div className="space-y-2 rounded-lg border border-border/50 p-3">
      <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <code
            className={cn(
              "block break-all rounded-md bg-muted py-2 pl-3 pr-10 font-mono text-xs",
              !revealed && "text-muted-foreground",
            )}
          >
            {displayValue}
          </code>
          {/* Unrecoverable keys offer no copy rather than a truncated one. */}
          {!error && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Copy ingestion key"
              className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
              disabled={isFetching}
              onClick={handleCopy}
            >
              <Copy className="size-3.5" />
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            isKeyVisible ? "Hide ingestion key" : "Reveal ingestion key"
          }
          onClick={handleToggleKey}
        >
          {isKeyVisible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2 pl-1">
        <span className="text-xs text-muted-foreground">
          Created {format(new Date(apiKey.createdAt), "PP 'at' p")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          disabled={deleteMutation.isPending}
          onClick={handleDelete}
        >
          <Trash2 />
          Delete
        </Button>
      </div>
      {error && (
        <p role="alert" className="pl-1 text-xs text-destructive">
          {error.message}
        </p>
      )}
    </div>
  );
}
