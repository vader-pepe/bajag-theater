import { readFile } from "node:fs/promises";
import path from "node:path";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import YTDlpWrap from "yt-dlp-wrap";
import { z } from "zod";

import { ServiceResponse } from "@/common/models/serviceResponse";
import { env } from "@/common/utils/envConfig";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { logger } from "@/server";

export const livestreamRegistry = new OpenAPIRegistry();
export const livesreamRouter: Router = express.Router();

livestreamRegistry.registerPath({
  method: "get",
  path: "/livestream",
  tags: ["Livestream"],
  responses: createApiResponse(z.string(), "Success"),
});

livesreamRouter.get("/output.m3u8", async (_req, res) => {
  const url = await readFile("url", "utf8").catch(() => "");
  const cookiesPath = path.resolve("cookies/cookies");
  const ytdlpath = path.resolve(".");
  const ytDlpWrap = new YTDlpWrap(`${ytdlpath}/yt-dlp`);
  const channel = env.isProd ? "https://www.youtube.com/@JKT48TV" : "https://www.youtube.com/@LofiGirl";
  let m3u8 = "";
  try {
    if (!url || url === "") {
    } else {
      logger.info(`URL already fetched (${url}). Skipping`);
      m3u8 = await ytDlpWrap.execPromise([url, "-g", "--cookies", cookiesPath]);
      const proxy_url = `${env.HLSD_HOST}`;
      const video_url = m3u8;
      const file_extension = ".m3u8";

      const hls_proxy_url = `${proxy_url}/${btoa(video_url)}${file_extension}`;

      const file = await fetch(hls_proxy_url);
      const content = await file.text();
      const serviceResponse = ServiceResponse.success("Success!", content);
      return handleServiceResponse(serviceResponse, res, true);
    }

    const serviceResponse = ServiceResponse.failure("Something went wrong", null);
    return handleServiceResponse(serviceResponse, res);

    // if (!m3u8.trim().endsWith("m3u8")) {
    //   await writeFile("url", "");
    // }
  } catch (error) {
    logger.error(error);
    const serviceResponse = ServiceResponse.failure("Something went wrong", null);
    return handleServiceResponse(serviceResponse, res);
  }
});
