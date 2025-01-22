import { existsSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import ffmpeg from "fluent-ffmpeg";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { GetReplaySchema } from "@/api/replay/replayModel";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { generateLinks } from "@/common/utils/dataMapping";
import { env } from "@/common/utils/envConfig";
import { handleServiceResponse, validateRequest } from "@/common/utils/httpHandlers";
import { logger } from "@/server";

export const replayRegistry = new OpenAPIRegistry();
export const replayRouter: Router = express.Router();

replayRegistry.registerPath({
  method: "get",
  path: "/replay/{date}",
  tags: ["Previous Shows"],
  responses: createApiResponse(z.string(), "Success"),
});

/**
 * Recursively lists files in a folder.
 * @param folderPath The path to the folder.
 * @returns A Promise that resolves to an array of file paths.
 */
async function fetchReplays(folderPath: string | null = "replay"): Promise<string[]> {
  const files: string[] = [];
  if (folderPath) {
    // check if folder accessible
    const entries = await readdir(folderPath, { withFileTypes: true }).catch(() => null);
    if (!entries) {
      return files;
    }

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);

      if (entry.isDirectory()) {
        const nestedFiles = await fetchReplays(fullPath);
        files.push(...nestedFiles);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

replayRouter.get("/", validateRequest(GetReplaySchema), async (req, res) => {
  const date = req.query.date as string;
  const data = await fetchReplays();

  if (date) {
    const filtered = data.filter((file) => file.includes(date));
    const serviceResponse = ServiceResponse.success("Success!", filtered);
    return handleServiceResponse(serviceResponse, res);
  }

  const serviceResponse = ServiceResponse.success("Success!", data);
  return handleServiceResponse(serviceResponse, res);
});

replayRouter.get("/htmx", validateRequest(GetReplaySchema), async (req, res) => {
  const date = req.query.date as string;
  const data = await fetchReplays();

  if (date === "undefined") {
    const stringData = generateLinks(data);
    const serviceResponse = ServiceResponse.success("Success fetch all files!", stringData);
    return handleServiceResponse(serviceResponse, res, true);
  }

  const filtered = data.filter((file) => file.includes(date));
  const stringData = generateLinks(filtered);
  const serviceResponse = ServiceResponse.success("Success!", stringData);
  return handleServiceResponse(serviceResponse, res, true);
});

interface Params {
  "0": string; // Matches the wildcard in '/play/*'
}

replayRouter.get("/duration/*", (req, res) => {
  const params = req.params as unknown as Params;
  const filepath = path.resolve(params[0]);
  if (!existsSync(filepath)) {
    const serviceResponse = ServiceResponse.failure("File does not exist!", null);
    return handleServiceResponse(serviceResponse, res);
  }

  ffmpeg.ffprobe(filepath, (err, metadata) => {
    if (err) {
      const serviceResponse = ServiceResponse.failure("File does not exist!", null);
      return handleServiceResponse(serviceResponse, res);
    }
    const serviceResponse = ServiceResponse.success("Success getting duration", metadata.format.duration);
    return handleServiceResponse(serviceResponse, res);
  });
});

replayRouter.get("/play/*", (req, res) => {
  const params = req.params as unknown as Params;
  const filepath = path.resolve(params[0]);
  const stat = statSync(filepath);
  const fileSize = stat.size;
  if (!existsSync(filepath)) {
    const serviceResponse = ServiceResponse.failure("File does not exist!", null);
    return handleServiceResponse(serviceResponse, res);
  }

  const headers = {
    "Content-Type": "video/mp4",
    "Content-Length": fileSize,
    "Accept-Ranges": "bytes",
  };

  res.writeHead(StatusCodes.PARTIAL_CONTENT, headers);

  if (env.isProd) {
    ffmpeg(filepath)
      .videoCodec("libx264") // Use software encoder (H.264 with libx264)
      .addOption("-threads", "1") // Single-threaded processing
      .addOption("-hwaccel", "cuda") // Use CUDA for hardware acceleration during decoding
      .addOption("-hwaccel_output_format", "cuda") // Specify CUDA output format
      .outputOptions([
        "-preset",
        "medium", // Encoding speed/quality tradeoff
        "-movflags",
        "frag_keyframe+empty_moov", // Fragmented MP4 for streaming
      ])
      .audioFilters("volume=2") // Example audio filter
      .format("mp4") // Set output format to MP4
      .on("error", (err) => {
        logger.error("FFmpeg error:");
        logger.error(err);
        if (!res.headersSent) {
          const serviceResponse = ServiceResponse.failure("Error while processing!", null);
          return handleServiceResponse(serviceResponse, res);
        }
      })
      .on("end", () => {
        logger.info("Streaming finished");
        res.end(); // Ensure response ends
      })
      .pipe(res, { end: true });
  } else {
    ffmpeg(filepath)
      .videoCodec("h264_vaapi")
      .addOption("-threads", "1") // Single-threaded processing
      .addOption("-vaapi_device", "/dev/dri/renderD128") // VA-API device
      .videoFilter("format=nv12|vaapi,hwupload") // Video filter for VA-API
      .outputOptions([
        "-movflags frag_keyframe+empty_moov", // Fragmented MP4 for streaming
      ])
      .audioFilters("volume=2") // Example audio filter
      .format("mp4") // Set output format to MP4
      .on("error", (err) => {
        logger.error("FFmpeg error:");
        logger.error(err);
        if (!res.headersSent) {
          const serviceResponse = ServiceResponse.failure("Error while processing!", null);
          return handleServiceResponse(serviceResponse, res);
        }
      })
      .on("end", () => {
        logger.info("Streaming finished");
        res.end(); // Ensure response ends
      })
      .pipe(res, { end: true });
  }
});
