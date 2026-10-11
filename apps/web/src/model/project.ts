import { z } from "zod";
import { project } from "@quacklytics/contracts";

export type Project = z.infer<typeof project>;
