import React from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button' // using a ShadCN button component
import {ApiKey, useApiKey, useApiKeys } from '@/services/apikyes'
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

    const handleShowKey = async () => {
        await refetch()
        setIsKeyVisible(true)
    }

    return (
        <div className="flex items-center justify-between border p-4 rounded-md">
            <div>
                <div className="text-sm text-gray-500">
                    Created at: {format(new Date(apiKey.createdAt), 'PPPpp')}
                </div>
            </div>
            <div>
                {isKeyVisible ? (
                    isLoading ? (
                        <span>Loading...</span>
                    ) : (
                        <span className="font-mono bg-muted text-xs p-2 rounded">{data?.key}</span>
                    )
                ) : (
                    <Button variant="outline" onClick={handleShowKey}>
                        Show Key
                    </Button>
                )}
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
