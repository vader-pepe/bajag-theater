import path from "node:path";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pino } from "pino";
import YTDlpWrap from "yt-dlp-wrap";

import { healthCheckRouter } from "@/api/healthCheck/healthCheckRouter";
import { replayRouter } from "@/api/replay/replayRoute";
import { scheduleRouter } from "@/api/schedule/scheduleRoute";
import { watchRouter } from "@/api/watch/watchRoute";
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
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

if (env.NODE_ENV !== "development") {
  app.use(rateLimiter);
}

// Request logging
app.use(requestLogger);

// Routes
app.use("/health-check", healthCheckRouter);
app.use("/schedule", scheduleRouter);
app.use(express.static(path.resolve("public")));
app.get("/livestream/output.m3u8", async (_req, res) => {
  const cookiesPath = path.resolve("cookies/cookies");
  const ytdlpath = path.resolve(".");
  const ytDlpWrap = new YTDlpWrap(`${ytdlpath}/yt-dlp`);
  try {
    const stdout = await ytDlpWrap.execPromise([
      "https://www.youtube.com/@JKT48TV/live",
      "-g",
      "--cookies",
      cookiesPath,
    ]);

    const proxy_url = "http://127.0.0.1:8080";
    const video_url = stdout;
    const file_extension = ".m3u8";

    const hls_proxy_url = `${proxy_url}/${btoa(video_url)}${file_extension}`;

    const file = await fetch(hls_proxy_url);
    const content = await file.text();

    return res.send(content);
  } catch (error) {
    return res.status(500).send("ERROR");
  }
});

app.use("/replay", replayRouter);
app.use("/watch", watchRouter);

app.get("/", async (_req, res) => {
  return res.sendFile(`${__dirname}/view.html`);
});

// Swagger UI
// app.use(openAPIRouter);

// Error handlers
app.use(errorHandler());

export { app, logger };
