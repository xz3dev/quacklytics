import {
  insight as insightSchema,
  insightInput,
  insightUpdate,
} from "@quacklytics/contracts";
import type { Insight, UsableInsightInput } from "@/model/insights/insight";
import { http } from "./http";
export const insightsApi = {
  getInsights: async (
    project: string,
    signal?: AbortSignal,
  ): Promise<Insight[]> => {
    return http.get(`${project}/insights`, insightSchema.array(), signal);
  },

  createInsight: async (params: {
    project: string;
    data: UsableInsightInput;
  }): Promise<Insight> => {
    return http.post(
      `${params.project}/insights`,
      insightInput.parse(params.data),
      insightSchema,
    );
  },

  deleteInsight: async (params: {
    project: string;
    insightId: number;
  }): Promise<void> => {
    await http.del(`${params.project}/insights/${params.insightId}`);
  },

  updateInsight: async (params: {
    project: string;
    insight: Insight;
  }): Promise<Insight> => {
    return http.put(
      `${params.project}/insights/${params.insight.id}`,
      insightUpdate.parse(params.insight),
      insightSchema,
    );
  },
};
