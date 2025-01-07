import { type PathLike, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Request, type Response, type Router } from "express";
import ffmpeg from "fluent-ffmpeg";
import { z } from "zod";

import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { generateLinks } from "@/common/utils/dataMapping";
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

const template = (filename: PathLike) => {
  return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Replay</title>
  <link href="/css/video-js.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css" type="text/css">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
  <link rel="manifest" href="/site.webmanifest">
</head>

<body>
  <section container>
    <video style="width: 100%; height: 350px;" id="vid1" class="vjs-default-skin" controls>
      <source src="/replay/play/${filename}" type="video/mp4">
    </video>
  </section>
  <script src="/js/video.min.js"></script>
</body>

</html>`;
};

function fetchReplays() {
  const data: Array<string> = [];
  if (existsSync("replay")) {
    readdirSync("replay").forEach((file) => {
      data.push(file);
    });
  }

  return data;
}

replayRouter.get("/", validateRequest(GetReplaySchema), (req, res) => {
  const date = req.query.date as string;
  const data = fetchReplays();

  if (date) {
    const filtered = data.filter((file) => file.includes(date));
    const serviceResponse = ServiceResponse.success("Success!", filtered);
    return handleServiceResponse(serviceResponse, res);
  }

  const serviceResponse = ServiceResponse.success("Success!", data);
  return handleServiceResponse(serviceResponse, res);
});

replayRouter.get("/htmx", validateRequest(GetReplaySchema), (req, res) => {
  const date = req.query.date as string;
  const data = fetchReplays();

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

replayRouter.get("/:filename", (req, res) => {
  const filename = req.params.filename;
  return res.send(template(filename));
});

replayRouter.get("/play/:filename", (req, res) => {
  const filename = req.params.filename;
  const filepath = path.resolve(`replay/${filename}`);
  if (!existsSync(filepath)) {
    const serviceResponse = ServiceResponse.failure("File does not exist!", null);
    return handleServiceResponse(serviceResponse, res);
  }

  res.writeHead(200, {
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
      console.error("FFmpeg error:", err.message);
      if (!res.headersSent) {
        const serviceResponse = ServiceResponse.failure("Failed!", null);
        return handleServiceResponse(serviceResponse, res);
      }
    })
    .on("end", () => {
      console.log("Streaming finished");
      return res.end(); // Ensure the response ends properly
    })
    .pipe(res, { end: true }); // Stream the output to the response
});
