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
import {
  fetchEvents,
  fetchScheduleSectionData,
  getSchedule,
  parseEvents,
  parseScheduleData,
  parseScheduleSectionData,
} from "@/common/utils/schedule";

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

scheduleRouter.get("/", async (req, res) => {
  try {
    const htmlData = await getSchedule();
    if (htmlData) {
      const scheduleData = parseScheduleData(htmlData);
      const serviceResponse = ServiceResponse.success("Successfully grab theater schedule!", scheduleData);
      return handleServiceResponse(serviceResponse, res, true);
    }
    const serviceResponse = ServiceResponse.failure("Failed grab theater schedule!", null);
    return handleServiceResponse(serviceResponse, res, true);
  } catch (error) {
    const err = error as Error;
    console.error("Error fetching or parsing schedule data:", err);
    const errorMessage = `Scraping schedule failed. Error: ${err.message}`;

    const serviceResponse = ServiceResponse.failure("Failed grab theater schedule!", errorMessage);
    return handleServiceResponse(serviceResponse, res, true);
  }
});

scheduleRouter.get("/section", async (req, res) => {
  try {
    const htmlData = await fetchScheduleSectionData();
    if (htmlData) {
      const theaterData = parseScheduleSectionData(htmlData);
      const serviceResponse = ServiceResponse.success("Successfully grab theater schedule!", theaterData);
      return handleServiceResponse(serviceResponse, res, true);
    }
    const serviceResponse = ServiceResponse.failure("Failed grab theater schedule!", null);
    return handleServiceResponse(serviceResponse, res, true);
  } catch (error) {
    const err = error as Error;
    console.error("Error fetching or parsing schedule section data:", err);
    const errorMessage = `Scraping schedule section failed. Error: ${err.message}`;

    const serviceResponse = ServiceResponse.failure("Failed grab theater schedule!", errorMessage);
    return handleServiceResponse(serviceResponse, res, true);
  }
});

scheduleRouter.get("/events", async (req, res) => {
  try {
    const htmlData = await fetchEvents();
    if (htmlData) {
      const parsedData = parseEvents(htmlData);
      const serviceResponse = ServiceResponse.success("Successfully grab events schedule!", parsedData);
      return handleServiceResponse(serviceResponse, res, true);
    }
    const serviceResponse = ServiceResponse.failure("Failed grab events schedule!", null);
    return handleServiceResponse(serviceResponse, res, true);
  } catch (error) {
    const err = error as Error;
    console.error("Error fetching or parsing specific data:", err);
    const errorMessage = `Scraping events failed. Error: ${err.message}`;

    const serviceResponse = ServiceResponse.failure("Failed grab theater schedule!", errorMessage);
    return handleServiceResponse(serviceResponse, res, true);
  }
});

scheduleRouter.get("/htmx", (_req, res) => {
  const data = parseHtml("public/calendar.html");
  if (data) {
    const stringData = formatTableData(data);
    const serviceResponse = ServiceResponse.success("Successfully grab theater schedule!", stringData);
    return handleServiceResponse(serviceResponse, res, true);
  }
  const serviceResponse = ServiceResponse.failure("Failed grab theater schedule!", null);
  return handleServiceResponse(serviceResponse, res, true);
});
