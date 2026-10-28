import { createdMcpToken, mcpToken } from "@quacklytics/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/client/api/http";

const MCP_TOKENS_KEY = (projectId: string) => ["mcpTokens", projectId] as const;

export function useMcpTokens(projectId: string) {
  return useQuery({
    queryKey: MCP_TOKENS_KEY(projectId),
    queryFn: () => http.get(`${projectId}/mcptokens`, mcpToken.array()),
  });
}

// Mutations refetch instead of patching the cache: refetching cancels a list
// request that started before the change and would overwrite it with stale rows.
export function useCreateMcpToken(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      http.post(`${projectId}/mcptokens`, undefined, createdMcpToken),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: MCP_TOKENS_KEY(projectId) }),
  });
}

export function useDeleteMcpToken(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => http.del(`${projectId}/mcptokens/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: MCP_TOKENS_KEY(projectId) }),
  });
}
