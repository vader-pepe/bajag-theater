import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import ffmpeg from "fluent-ffmpeg";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { GetReplaySchema } from "@/api/replay/replayModel";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { generateLinks } from "@/common/utils/dataMapping";
import { handleServiceResponse, validateRequest } from "@/common/utils/httpHandlers";
import { logger } from "@/server";
import { StatusCodes } from "http-status-codes";

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

interface PlayParams {
  "0": string; // Matches the wildcard in '/play/*'
}

replayRouter.get("/play/*", (req, res) => {
  const params = req.params as unknown as PlayParams;
  const filepath = path.resolve(params[0]);
  if (!existsSync(filepath)) {
    const serviceResponse = ServiceResponse.failure("File does not exist!", null);
    return handleServiceResponse(serviceResponse, res);
  }

  res.writeHead(StatusCodes.PARTIAL_CONTENT, {
    "Content-Type": "video/mp4",
    "Transfer-Encoding": "chunked",
  });

  ffmpeg(filepath)
    .outputOptions([
      "-movflags frag_keyframe+empty_moov", // Enables fragmented MP4 for streaming
      "-c:v libx264", // Video codec
      "-preset ultrafast", // Faster encoding
      "-c:a aac", // Audio codec
      "-b:v 1000k", // Video bitrate
      "-b:a 128k", // Audio bitrate
    ])
    .audioFilters("volume=2")
    .format("mp4") // Set output format
    .on("error", (err) => {
      logger.error("FFmpeg error:", err.message);
      if (!res.headersSent) {
        const serviceResponse = ServiceResponse.failure("Failed!", null);
        return handleServiceResponse(serviceResponse, res);
      }
    })
    .on("end", () => {
      logger.info("Streaming finished");
      return res.end(); // Ensure the response ends properly
    })
    .pipe(res, { end: true }); // Stream the output to the response
});
