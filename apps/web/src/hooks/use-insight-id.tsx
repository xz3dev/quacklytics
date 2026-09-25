import { useParams } from "@/lib/navigation";

export function useInsightId() {
  const { insightid } = useParams();
  const insightIdAsNumber = insightid ? parseInt(insightid) : undefined;
  if (!insightIdAsNumber || isNaN(insightIdAsNumber))
    throw new Error("Insight ID illegal or missing.");
  return insightIdAsNumber;
}
