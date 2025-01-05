import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const GetReplaySchema = z.object({
  params: z.object({
    date: z.string().date(),
  }),
});
