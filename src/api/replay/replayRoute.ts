import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse, validateRequest } from "@/common/utils/httpHandlers";
import { GetReplaySchema } from "./replayModel";

export const replayRegistry = new OpenAPIRegistry();
export const replayRouter: Router = express.Router();

replayRegistry.registerPath({
  method: "get",
  path: "/replay/{date}",
  tags: ["Previous Shows"],
  responses: createApiResponse(z.string(), "Success"),
});

replayRouter.get("/:date", validateRequest(GetReplaySchema), (_req, res) => {
  const date = _req.params.date;
  const serviceResponse = ServiceResponse.success("Success!", date);
  return handleServiceResponse(serviceResponse, res);
});
