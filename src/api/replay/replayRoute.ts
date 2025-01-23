import { createReadStream, existsSync, statSync } from "node:fs";
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
import { handleServiceResponse, validateRequest } from "@/common/utils/httpHandlers";

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
  const videoSize = statSync(filepath).size;
  const range = req.headers.range || `bytes=0-${Math.min(10 ** 6 - 1, videoSize - 1)}`;

  if (!existsSync(filepath)) {
    const serviceResponse = ServiceResponse.failure("File does not exist!", null);
    return handleServiceResponse(serviceResponse, res);
  }

  const CHUNK_SIZE = 10 ** 6;
  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);
  const contentLength = end - start + 1;

  const headers = {
    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": contentLength,
    "Content-Type": "video/mp4",
  };

  res.writeHead(StatusCodes.PARTIAL_CONTENT, headers);

  const videoStream = createReadStream(filepath, { start, end });
  videoStream.pipe(res);
});
