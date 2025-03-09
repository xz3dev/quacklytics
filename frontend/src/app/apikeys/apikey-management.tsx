import {Button} from '@/components/ui/button' // using a ShadCN button component
import {useApiKeys, useCreateApiKey,} from '@/services/apikeys.ts'
import {useProjectId} from '@/hooks/use-project-id'
import {ApiKeyRow} from "@app/apikeys/api-key-row.tsx";

export function ApikeyManagement() {
    // Initially load the list of API keys without the actual key value.
    const projectId = useProjectId()
    const {data: apiKeys, isLoading, error} = useApiKeys(projectId)
    const createMutation = useCreateApiKey(projectId)

    const handleCreate = async () => {
        try {
            await createMutation.mutateAsync()
        } catch (error) {
            console.error("Failed to create API key:", error)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <h2 className="text-2xl font-bold flex-1">
                    Api Keys
                </h2>
                <Button onClick={handleCreate}>
                    {"Create API Key"}
                </Button>
            </div>
            {isLoading ? (
                <div>Loading API keys...</div>
            ) : error ? (
                <div>Error loading API keys.</div>
            ) : !apiKeys || apiKeys.length === 0 ? (
                <div className="p-4 text-center">No API keys found.</div>
            ) : (
                apiKeys.map((apiKey) => (
                    <ApiKeyRow key={apiKey.id} projectId={projectId} apiKey={apiKey}/>
                ))
            )}
        </div>
    )
}
