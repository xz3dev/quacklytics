import {
  dashboardTemplateInput,
  dashboardInsightIds,
  dashboardLayoutInput,
} from "@quacklytics/contracts";
import {
  listDashboards,
  getDashboard,
  saveDashboard,
  deleteDashboard,
  setHomeDashboard,
  setDashboardInsights,
  setDashboardLayout,
} from "../domain/dashboards";
import { createTemplate, restoreDefaultDashboard } from "../domain/templates";
import { RequestError } from "../errors";
import { json, body, type ProjectRequest } from "./shared";
export async function dashboardsHandler({
  request,
  db,
  id,
  idText,
  action,
  segments,
}: ProjectRequest): Promise<Response> {
  if (idText === "default" && !action && request.method === "POST")
    return json(restoreDefaultDashboard(db));
  if (
    request.method === "POST" &&
    (idText === "templates" || (id !== undefined && action === "templates"))
  ) {
    const input = dashboardTemplateInput.parse(await body(request));
    return json(
      createTemplate(
        db,
        idText === "templates" ? (action ?? "") : (segments[4] ?? ""),
        input.home ?? false,
        input.name,
        id,
      ),
    );
  }
  if (idText && id === undefined)
    throw new RequestError(404, "Route not found");
  if (action) {
    if (id === undefined || !["home", "insights", "layout"].includes(action))
      throw new RequestError(404, "Route not found");
    if (request.method !== "PUT")
      throw new RequestError(405, "Method not allowed");
    if (action === "home") return json(setHomeDashboard(db, id));
    if (action === "insights")
      return json(
        setDashboardInsights(
          db,
          id,
          dashboardInsightIds.parse(await body(request)).insight_ids,
        ),
      );
    return json(
      setDashboardLayout(
        db,
        id,
        dashboardLayoutInput.parse(await body(request)).layout,
      ),
    );
  }
  if (request.method === "GET")
    return json(id === undefined ? listDashboards(db) : getDashboard(db, id));
  if (request.method === "DELETE" && id !== undefined) {
    deleteDashboard(db, id);
    return json(null);
  }
  if (
    (request.method === "POST" && id === undefined) ||
    (request.method === "PUT" && id !== undefined)
  )
    return json(saveDashboard(db, await body(request), id));
  throw new RequestError(405, "Method not allowed");
}
