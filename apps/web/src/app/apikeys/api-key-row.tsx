import { ApiKey, useApiKey, useDeleteApiKey } from "@/services/apikeys.ts";
import React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button.tsx";
import { Eye, EyeOff, Copy } from "lucide-react";
import { cn } from "@lib/utils/tailwind.ts";
import { toast } from "sonner";

interface ApiKeyRowProps {
  projectId: string;
  apiKey: ApiKey;
}

export function ApiKeyRow({ projectId, apiKey }: ApiKeyRowProps) {
  // Disable automatic fetching until the API key is requested.
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

  const handleCopy = async () => {
    if (data?.key && !isFetching) {
      try {
        await navigator.clipboard.writeText(data.key);
        toast.success("API key copied to clipboard!");
      } catch (error) {
        console.error("Failed to copy API key:", error);
        toast.error("Failed to copy API key");
      }
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this API key?",
    );
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(apiKey.id);
    } catch (error) {
      console.error("Failed to delete API key:", error);
    }
  };

  // Determine what to display.
  const displayValue = isKeyVisible
    ? isFetching
      ? "Loading..."
      : error
        ? error.message
        : data?.key || ""
    : "********************";

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-lg bg-muted p-4">
      <div className="flex-1">
        <div className="text-sm text-muted-foreground">
          Created at: {format(new Date(apiKey.createdAt), "PPPpp")}
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex min-w-0 max-w-full items-center font-mono text-xs">
          <span
            className={cn(
              isKeyVisible ? "" : "text-muted-foreground",
              "mr-2 min-w-0 break-all",
            )}
          >
            {displayValue}
          </span>
          {isKeyVisible && !isFetching && data?.key && (
            <>
              <Button
                variant="ghost"
                aria-label="Copy API key"
                onClick={handleCopy}
                className="ml-2 p-1 w-6"
              >
                <Copy size={16} />
              </Button>
              <Button
                variant="ghost"
                aria-label="Hide API key"
                onClick={handleToggleKey}
                className="ml-2 p-1 w-6"
              >
                <EyeOff size={16} />
              </Button>
            </>
          )}
          {!isKeyVisible && (
            <Button
              variant="ghost"
              aria-label="Reveal API key"
              onClick={handleToggleKey}
              className="ml-2 p-1 w-6"
            >
              <Eye size={16} />
            </Button>
          )}
        </div>
        <Button variant="destructive" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
