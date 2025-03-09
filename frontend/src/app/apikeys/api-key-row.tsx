import { ApiKey, useApiKey, useDeleteApiKey } from "@/services/apikeys.ts";
import React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button.tsx";
import { Eye, EyeOff, Copy } from "lucide-react";
import {cn} from "@lib/utils/tailwind.ts";

interface ApiKeyRowProps {
    projectId: string;
    apiKey: ApiKey;
}

export function ApiKeyRow({ projectId, apiKey }: ApiKeyRowProps) {
    // Disable automatic fetching until the API key is requested.
    const { data, refetch, isLoading } = useApiKey(projectId, apiKey.id, {
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
        if (data?.key && !isLoading) {
            try {
                await navigator.clipboard.writeText(data.key);
            } catch (error) {
                console.error("Failed to copy API key:", error);
            }
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

    // Determine what to display.
    const displayValue = isKeyVisible
        ? isLoading
            ? "Loading..."
            : data?.key || ""
        : "********************";

    return (
        <div className="flex items-center justify-between border p-4 rounded-md space-x-4">
            <div className="flex-1">
                <div className="text-sm text-gray-500">
                    Created at: {format(new Date(apiKey.createdAt), "PPPpp")}
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <div className="flex items-center bg-muted font-mono text-xs px-4 rounded">
                    <span
                        className={cn(isKeyVisible ? "" : "text-muted-foreground", "mr-2")}
                    >{displayValue}</span>
                    {isKeyVisible && !isLoading && data?.key && (
                        <>
                            <Button variant="ghost" onClick={handleCopy} className="ml-2 p-1 w-6">
                                <Copy size={16} />
                            </Button>
                            <Button variant="ghost" onClick={handleToggleKey} className="ml-2 p-1 w-6">
                                <EyeOff size={16} />
                            </Button>
                        </>
                    )}
                    {/* If key is hidden, only show the toggle button */}
                    {!isKeyVisible && (
                        <Button variant="ghost" onClick={handleToggleKey} className="ml-2 p-1 w-6">
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
