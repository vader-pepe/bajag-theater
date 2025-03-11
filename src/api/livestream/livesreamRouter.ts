import { readFile } from "node:fs/promises";
import path from "node:path";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import ffmpeg from "fluent-ffmpeg";
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

async function getM3u8() {
  const url = await readFile("url", "utf8").catch(() => "");
  const cookiesPath = path.resolve("cookies/cookies");
  const ytdlpath = path.resolve(".");
  const ytDlpWrap = new YTDlpWrap(`${ytdlpath}/yt-dlp`);
  const m3u8 = await ytDlpWrap.execPromise([url, "-g", "--cookies", cookiesPath]);

  return m3u8;
}

livesreamRouter.get("/output.m3u8", async (req, res) => {
  const sourceUrl = `${req.protocol}://${req.get("host")}`;
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

livesreamRouter.get("/raw.m3u8", async (_req, res) => {
  const url = await readFile("url", "utf8").catch(() => "");
  if (url) {
    const m3u8 = await getM3u8();

    const serviceResponse = ServiceResponse.success("Success!", m3u8);
    return handleServiceResponse(serviceResponse, res, true);
  }
  const serviceResponse = ServiceResponse.failure("Something went wrong", "No URL Found!");
  return handleServiceResponse(serviceResponse, res);
});

livesreamRouter.get("/video.mp4", async (_req, res) => {
  const url = await readFile("url", "utf8").catch(() => "");
  const cookiesPath = path.resolve("cookies/cookies");
  const ytdlpath = path.resolve(".");
  const ytDlpWrap = new YTDlpWrap(`${ytdlpath}/yt-dlp`);
  if (url) {
    res.setHeader("Content-Type", "video/mp4");
    const readableStream = ytDlpWrap.execStream([url, "--cookies", cookiesPath, "--ffmpeg-location", env.FFMPEG_PATH]);

    ffmpeg.setFfmpegPath(env.FFMPEG_PATH);
    if (env.HW_ACCEL === "VAAPI") {
      return ffmpeg(readableStream)
        .inputOptions(["-hwaccel vaapi", "-vaapi_device /dev/dri/renderD128"])
        .outputOptions([
          "-vf format=nv12,hwupload",
          "-c:v h264_vaapi", // Use VAAPI encoder.
          "-movflags frag_keyframe+empty_moov",
        ])
        .on("start", (cmd) => logger.info(`command: ${cmd}`))
        .on("progress", (prg) => logger.info(`frames: ${prg.frames}`))
        .on("error", (err) => logger.error(err))
        .outputFormat("mp4")
        .pipe(res, { end: true });
    } else if (env.HW_ACCEL === "NVENC") {
      // TODO: not working
      return ffmpeg(readableStream)
        .inputOptions(["-hwaccel cuda", "-hwaccel_output_format cuda"])
        .outputOptions([
          "-vf format=nv12,hwupload_cuda",
          "-loglevel debug",
          "-c:v h264_nvenc", // Use NVENC encoder.
          "-movflags frag_keyframe+empty_moov",
        ])
        .outputFormat("mp4")
        .on("start", (cmd) => logger.info(`command: ${cmd}`))
        .on("progress", (prg) => logger.info(`frames: ${prg.frames}`))
        .on("error", (err) => logger.error(err))
        .pipe(res, { end: true });
    }
  }

  const serviceResponse = ServiceResponse.failure("Something went wrong", "No URL Found!");
  return handleServiceResponse(serviceResponse, res);
});
