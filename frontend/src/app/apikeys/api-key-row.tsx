import { ApiKey, useApiKey, useDeleteApiKey } from "@/services/apikeys.ts";
import React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button.tsx";

interface ApiKeyRowProps {
    projectId: string;
    apiKey: ApiKey;
}

export function ApiKeyRow({ projectId, apiKey }: ApiKeyRowProps) {
    // Disable automatic fetching of the full key until the user clicks the button.
    const { data, refetch, isLoading } = useApiKey(projectId, apiKey.id, {
        enabled: false,
    });

    const [isKeyVisible, setIsKeyVisible] = React.useState(false);
    const deleteMutation = useDeleteApiKey(projectId);

    const handleToggleKey = async () => {
        if (isKeyVisible) {
            // Hide the key
            setIsKeyVisible(false);
        } else {
            // Fetch and show the key
            void refetch();
            setIsKeyVisible(true);
        }
    };

    const handleDelete = async () => {
        const confirmed = window.confirm("Are you sure you want to delete this API key?");
        if (!confirmed) return;
        try {
            await deleteMutation.mutateAsync(apiKey.id);
        } catch (error) {
            console.error("Failed to delete API key:", error);
        }
    };

    return (
        <div className="flex items-center justify-between border p-4 rounded-md space-x-4">
            <div className="flex-1">
                <div className="text-sm text-gray-500">
                    Created at: {format(new Date(apiKey.createdAt), 'PPPpp')}
                </div>
            </div>
            <div className="flex items-center space-x-2">
                {isKeyVisible ? (
                    isLoading ? (
                        <span>Loading...</span>
                    ) : (
                        <span className="font-mono bg-muted text-xs p-2 rounded">
              {data?.key}
            </span>
                    )
                ) : null}
                <Button variant="outline" onClick={handleToggleKey}>
                    {isKeyVisible ? "Hide Key" : "Show Key"}
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                    Delete
                </Button>
            </div>
        </div>
    );
}
