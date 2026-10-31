import { mcpToken, revealedMcpToken } from "@quacklytics/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/client/api/http";

const MCP_TOKENS_KEY = ["mcpTokens"] as const;
const MCP_TOKEN_KEY = (id: number) => [...MCP_TOKENS_KEY, id] as const;

export function useMcpTokens() {
  return useQuery({
    queryKey: MCP_TOKENS_KEY,
    queryFn: () => http.get("mcptokens", mcpToken.array()),
  });
}

/** The full secret, fetched only while a token is shown or copied. */
export function useMcpTokenSecret(id: number, enabled: boolean) {
  return useQuery({
    queryKey: MCP_TOKEN_KEY(id),
    queryFn: () => http.get(`mcptokens/${id}`, revealedMcpToken),
    enabled,
  });
}

// Mutations refetch instead of patching the list: refetching cancels a list
// request that started before the change and would overwrite it with stale rows.
export function useCreateMcpToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => http.post("mcptokens", undefined, revealedMcpToken),
    onSuccess: (created) => {
      queryClient.setQueryData(MCP_TOKEN_KEY(created.id), created);
      return queryClient.invalidateQueries({
        queryKey: MCP_TOKENS_KEY,
        exact: true,
      });
    },
  });
}

export function useDeleteMcpToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => http.del(`mcptokens/${id}`),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: MCP_TOKEN_KEY(id) });
      return queryClient.invalidateQueries({
        queryKey: MCP_TOKENS_KEY,
        exact: true,
      });
    },
  });
}
