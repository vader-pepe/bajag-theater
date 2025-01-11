import { type PathLike, existsSync, readFileSync } from "node:fs";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { formatTableData, mapDaysToData } from "@/common/utils/dataMapping";
import { getDaysForCurrentWeek } from "@/common/utils/date";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { findAndExtractUsingRegex, parseSchedule } from "@/common/utils/regex";

export const scheduleRegistry = new OpenAPIRegistry();
export const scheduleRouter: Router = express.Router();

function parseHtml(path: PathLike) {
  if (existsSync(path)) {
    const html = readFileSync(path, "utf8");
    const extractedHtml = findAndExtractUsingRegex(html);
    const parsedHtml = parseSchedule(extractedHtml);
    const dates = getDaysForCurrentWeek();
    const jsonData = mapDaysToData(dates, parsedHtml);
    return jsonData;
  }
  return null;
}

scheduleRegistry.registerPath({
  method: "get",
  path: "/schedule",
  tags: ["Theater Schedule"],
  responses: createApiResponse(z.string(), "Success"),
});

scheduleRouter.get("/", (_req, res) => {
  const data = parseHtml("src/calendar.html");
  if (data) {
    const serviceResponse = ServiceResponse.success("Successfully grab theater schedule!", data);
    return handleServiceResponse(serviceResponse, res);
  }
  const serviceResponse = ServiceResponse.failure("Failed grab theater schedule!", null);
  return handleServiceResponse(serviceResponse, res);
});

scheduleRouter.get("/htmx", (_req, res) => {
  const data = parseHtml("src/calendar.html");
  if (data) {
    const stringData = formatTableData(data);
    const serviceResponse = ServiceResponse.success("Successfully grab theater schedule!", stringData);
    return handleServiceResponse(serviceResponse, res, true);
  }
  const serviceResponse = ServiceResponse.failure("Failed grab theater schedule!", null);
  return handleServiceResponse(serviceResponse, res, true);
});
