import { projectSetup } from "@quacklytics/contracts";
import { useQuery } from "@tanstack/react-query";
import { http } from "@/client/api/http";

/**
 * Polls while the setup screen is open, so a resent event after a fix shows
 * up without a reload.
 */
export function useProjectSetup(projectId: string) {
  return useQuery({
    queryKey: ["projectSetup", projectId],
    queryFn: ({ signal }) =>
      http.get(`${projectId}/setup`, projectSetup, signal),
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
  });
}
