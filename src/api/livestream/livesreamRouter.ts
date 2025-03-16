import { readFile } from "node:fs/promises";
import path from "node:path";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
// @ts-ignore
import proxy from "@warren-bank/hls-proxy/hls-proxy/proxy";
import express, { type Router } from "express";
import ffmpeg from "fluent-ffmpeg";
import YTDlpWrap from "yt-dlp-wrap";
import { z } from "zod";

const middleware = proxy({
  is_secure: false,
  host: null,
  copy_req_headers: false,
  req_headers: null,
  req_options: null,
  hooks: null,
  cache_segments: true,
  max_segments: 20,
  cache_timeout: 60,
  cache_key: 0,
  cache_storage: null,
  cache_storage_fs_dirpath: null,
  debug_level: 3,
  acl_ip: null,
  acl_pass: null,
  http_proxy: null,
  manifest_extension: null,
  segment_extension: null,
});

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

async function getM3u8() {
  const url = await readFile("url", "utf8").catch(() => "");
  const cookiesPath = path.resolve("cookies/cookies");
  const ytdlpath = path.resolve(".");
  const ytDlpWrap = new YTDlpWrap(`${ytdlpath}/yt-dlp`);
  const m3u8 = await ytDlpWrap.execPromise([url, "-g", "--cookies", cookiesPath]);

  return m3u8;
}

livesreamRouter.get("/proxy/*", middleware.request);

livesreamRouter.get("/output.m3u8", async (req, res) => {
  const sourceUrl = `${env.isProduction ? "https" : "http"}://${req.get("host")}`;
  const url = await readFile("url", "utf8").catch(() => "");
  try {
    if (url) {
      logger.info(`URL already fetched (${url}). Skipping`);
      const proxy_url = `${sourceUrl}/livestream/proxy`;
      const video_url = await getM3u8();
      const file_extension = ".m3u8";

      const hls_proxy_url = `${proxy_url}/${btoa(video_url)}${file_extension}`;

      const file = await fetch(hls_proxy_url);
      const content = await file.text();
      const serviceResponse = ServiceResponse.success("Success!", content);
      return handleServiceResponse(serviceResponse, res, true);
    }

    const serviceResponse = ServiceResponse.failure("Something went wrong", "No livestream URL!");
    return handleServiceResponse(serviceResponse, res);
  } catch (error) {
    logger.error(error);
    const serviceResponse = ServiceResponse.failure("Something went wrong", null);
    return handleServiceResponse(serviceResponse, res);
  }
});

livesreamRouter.get("/raw", async (_req, res) => {
  const cookiesPath = path.resolve("cookies/cookies");
  const ytdlpath = path.resolve(".");
  const ytDlpWrap = new YTDlpWrap(`${ytdlpath}/yt-dlp`);
  const url = await readFile("url", "utf8").catch(() => "");
  if (!url) {
    const serviceResponse = ServiceResponse.failure("Something went wrong", "No URL Found!");
    return handleServiceResponse(serviceResponse, res);
  }

  const readableStream = ytDlpWrap.execStream([url, "--cookies", cookiesPath, "--ffmpeg-location", env.FFMPEG_PATH]);

  readableStream.pipe(res);
});

livesreamRouter.get("/index.m3u8", async (_req, res) => {
  const url = await readFile("url", "utf8").catch(() => "");
  const cookiesPath = path.resolve("cookies/cookies");
  const ytdlpath = path.resolve(".");
  const ytDlpWrap = new YTDlpWrap(`${ytdlpath}/yt-dlp`);
  if (!url) {
    const serviceResponse = ServiceResponse.failure("Something went wrong", "No URL Found!");
    return handleServiceResponse(serviceResponse, res);
  }

  if (url) {
    res.setHeader("Content-Type", "video/mp4");
    const readableStream = ytDlpWrap.execStream([url, "--cookies", cookiesPath, "--ffmpeg-location", env.FFMPEG_PATH]);
  }
});
