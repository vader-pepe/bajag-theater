import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const GetReplaySchema = z.object({
  query: z.object({
    date: z.optional(z.string()),
  }),
});
