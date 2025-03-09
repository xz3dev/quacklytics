import React from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button' // using a ShadCN button component
import { ApiKey, useApiKey, useApiKeys, useDeleteApiKey } from '@/services/apikeys.ts'
import { useProjectId } from '@/hooks/use-project-id'

interface ApiKeyRowProps {
    projectId: string
    apiKey: ApiKey
}

function ApiKeyRow({ projectId, apiKey }: ApiKeyRowProps) {
    // Disable automatic fetching of the full key until the user clicks the button.
    const { data, refetch, isLoading } = useApiKey(projectId, apiKey.id, {
        enabled: false,
    })

    const [isKeyVisible, setIsKeyVisible] = React.useState(false)
    const deleteMutation = useDeleteApiKey(projectId)

    const handleShowKey = async () => {
        void refetch()
        setIsKeyVisible(true)
    }

    const handleDelete = async () => {
        const confirmed = window.confirm("Are you sure you want to delete this API key?")
        if (!confirmed) return
        try {
            await deleteMutation.mutateAsync(apiKey.id)
        } catch (error) {
            console.error("Failed to delete API key:", error)
        }
    }

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
                ) : (
                    <Button variant="outline" onClick={() => handleShowKey()}>
                        Show Key
                    </Button>
                )}
                <Button variant="destructive" onClick={() => handleDelete()}>
                    Delete
                </Button>
            </div>
        </div>
    )
}

export function ApikeyManagement() {
    // Initially load the list of API keys without the actual key value.
    const projectId = useProjectId()
    const { data: apiKeys, isLoading, error } = useApiKeys(projectId)

    if (isLoading) return <div>Loading API keys...</div>
    if (error) return <div>Error loading API keys.</div>
    if (!apiKeys || apiKeys.length === 0)
        return <div className="p-4 text-center">No API keys found.</div>

    return (
        <div className="space-y-4">
            {apiKeys.map((apiKey) => (
                <ApiKeyRow key={apiKey.id} projectId={projectId} apiKey={apiKey} />
            ))}
        </div>
    )
}
