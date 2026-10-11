import type { Database } from "bun:sqlite";
import { insightInput, insightUpdate } from "@quacklytics/contracts";
import * as repository from "../repositories/insights";
import { RequestError } from "../errors";
export const listInsights = repository.listInsights;
export function getInsight(db: Database, id: number) {
  const value = repository.findInsight(db, id);
  if (!value) throw new RequestError(404, "Insight not found");
  return value;
}
export function saveInsight(db: Database, input: unknown, id?: number) {
  const value = (id === undefined ? insightInput : insightUpdate).parse(input);
  if (id !== undefined) getInsight(db, id);
  return repository.writeInsight(db, value, id);
}
export function deleteInsight(db: Database, id: number) {
  getInsight(db, id);
  repository.deleteInsight(db, id);
}
