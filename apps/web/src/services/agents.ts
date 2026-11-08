import { agentAccess } from "@quacklytics/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "@/client/api/http";

const AGENTS_KEY = ["agents"] as const;

/** The MCP endpoint and the agents the signed-in user approved. */
export function useAgentAccess() {
  return useQuery({
    queryKey: AGENTS_KEY,
    queryFn: ({ signal }) => http.get("agents", agentAccess, signal),
  });
}

// Refetches instead of patching the list: refetching cancels a list request
// that started before the change and would overwrite it with stale rows.
export function useDisconnectAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      http.del(`agents/${encodeURIComponent(clientId)}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: AGENTS_KEY, exact: true }),
  });
}
