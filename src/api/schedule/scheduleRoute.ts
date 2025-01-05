import { existsSync, readFileSync } from "node:fs";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { formatTableData, mapDaysToData } from "@/common/utils/dataMapping";
import { getDaysForCurrentWeek } from "@/common/utils/date";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { findAndExtractUsingRegex, parseSchedule } from "@/common/utils/regex";

export const scheduleRegistry = new OpenAPIRegistry();
export const scheduleRouter: Router = express.Router();

scheduleRegistry.registerPath({
  method: "get",
  path: "/schedule",
  tags: ["Theater Schedule"],
  responses: createApiResponse(z.string(), "Success"),
});

scheduleRouter.get("/", (_req, res) => {
  if (existsSync("src/calendar.html")) {
    const html = readFileSync("src/calendar.html", "utf8");
    const extractedHtml = findAndExtractUsingRegex(html);
    const parsedHtml = parseSchedule(extractedHtml);
    const dates = getDaysForCurrentWeek();
    const jsonData = mapDaysToData(dates, parsedHtml);
    const table = formatTableData(jsonData);

    const serviceResponse = ServiceResponse.success("Successfully grab theater schedule!", table);
    return handleServiceResponse(serviceResponse, res);
  }
  const serviceResponse = ServiceResponse.failure("Failed grab theater schedule!", null);
  return handleServiceResponse(serviceResponse, res);
});
