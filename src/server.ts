import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pino } from "pino";
import { statSync, createReadStream, existsSync } from "fs"
import path from "path";
import ffmpeg from "fluent-ffmpeg"

import { openAPIRouter } from "@/api-docs/openAPIRouter";
import { healthCheckRouter } from "@/api/healthCheck/healthCheckRouter";
// import { userRouter } from "@/api/user/userRouter";
import errorHandler from "@/common/middleware/errorHandler";
import rateLimiter from "@/common/middleware/rateLimiter";
import requestLogger from "@/common/middleware/requestLogger";
import { env } from "@/common/utils/envConfig";

const logger = pino({ name: "server start" });
const app: Express = express();

// Set the application to trust the reverse proxy
app.set("trust proxy", true);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(rateLimiter);

// Request logging
app.use(requestLogger);

// Routes
app.use("/health-check", healthCheckRouter);
app.use("/ffmpeg", express.static(path.resolve("node_modules/@ffmpeg")));
// app.use("/users", userRouter);
app.get("/", function(_req, res) {
  res.sendFile(__dirname + "/index.html");
})

// TODO: not yet fixed!
app.get("/livestream", function(req, res) {
  const videoPath = path.resolve(__dirname, "../output.part");
  if (!existsSync(videoPath)) {
    return res.status(404).send('File not found');
  }

  let range = req.headers.range;
  if (!range) {
    range = "bytes=0-";
  }

  const videoSize = statSync(videoPath).size;
  const CHUNK_SIZE = 100 ** 6;
  const start = Number(range.replace(/\D/g, ""))
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);;
  const contentLength = end - start + 1;
  const headers = {
    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": contentLength,
    "Content-Type": "video/mpeg",
  };
  res.writeHead(206, headers);
  const videoStream = createReadStream(videoPath, { start, end });
  return videoStream.pipe(res);
})

// Swagger UI
app.use(openAPIRouter);

// Error handlers
app.use(errorHandler());

export { app, logger };
