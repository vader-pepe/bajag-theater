import { access, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import cron from "node-cron";
import YTDlpWrap from "yt-dlp-wrap";

import { transformInput } from "@/common/utils/dataMapping";
import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";

const { NODE_ENV, HOST, PORT } = env;
const server = app.listen(env.PORT, () => {
  logger.info(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);
});

const onCloseSignal = () => {
  logger.info("sigint received, shutting down");
  server.close(() => {
    logger.info("server closed");
    process.exit();
  });
  setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after 10s
};

cron.schedule("* * * * *", async () => {
  const cookiesPath = path.resolve("cookies/cookies");
  const outputPath = "video/output.%(ext)s";
  const channel = env.isProd ? "https://www.youtube.com/@JKT48TV" : "https://www.youtube.com/@LofiGirl";
  const ytdlPath = path.resolve(".");
  const ytDlpWrap = new YTDlpWrap(`${ytdlPath}/yt-dlp`);

  const isDownloading = (await readFile("isDownloading", "utf8").catch(() => "")) === "true";
  let url = await readFile("url", "utf8").catch(() => "");

  // Check if video/output.mkv exists
  const fileExists = await access(outputPath)
    .then(() => true)
    .catch(() => false);

  if (fileExists) {
    logger.info(`${outputPath} exists. Checking if livestream is ongoing...`);
    // Check if livestream is still ongoing
    try {
      const m3u8 = await ytDlpWrap.execPromise([url, "-g", "--cookies", cookiesPath]);
      if (m3u8.trim().endsWith("m3u8")) {
        logger.info("Livestream is ongoing. Deleting existing file...");
        await unlink(outputPath);
      } else {
        logger.info("Livestream has ended. Clearing URL.");
        await writeFile("url", "");
        return;
      }
    } catch (error) {
      logger.error("Error while checking livestream status:", error);
      return;
    }
  }

  // Fetch URL if not present
  if (!url) {
    logger.info(`Fetching URL for ${channel}`);
    try {
      const stdout = await ytDlpWrap.execPromise([
        "--cookies",
        cookiesPath,
        "--flat-playlist",
        "--match-filter",
        "is_live",
        channel,
        "--print-json",
      ]);

      const altered = transformInput(stdout);
      const filtered = altered.filter((item) => item.is_live === true);
      const tempUrl = filtered?.[0]?.url || "";
      if (!tempUrl) {
        logger.info("No live stream found");
        return;
      }
      logger.info(`URL found: ${tempUrl}`);
      await writeFile("url", tempUrl);
      url = tempUrl;
    } catch (error) {
      logger.error("Error fetching URL:", error);
      return;
    }
  }

  // Start download if not already downloading
  if (!isDownloading && url) {
    logger.info("Starting stream download");
    await writeFile("isDownloading", "true");

    const ytDlpEventEmitter = ytDlpWrap.exec([
      url,
      "--live-from-start",
      "--cookies",
      cookiesPath,
      "--merge-output-format",
      "mkv",
      "-o",
      outputPath,
    ]);

    ytDlpEventEmitter
      .on("progress", (progress) => {
        logger.info(`Progress: ${progress.percent}% | Speed: ${progress.currentSpeed} | ETA: ${progress.eta}`);
      })
      .on("ytDlpEvent", (eventType, eventData) => {
        logger.info(`Event: ${eventType} | Data: ${JSON.stringify(eventData)}`);
      })
      .on("error", async (error) => {
        logger.error("Download error occurred", error);
        await writeFile("isDownloading", "false");
      })
      .on("close", async () => {
        logger.info("Stream download completed or process ended");
        await writeFile("isDownloading", "false");
        await writeFile("url", "");
      });

    logger.info(`Download process started with PID: ${ytDlpEventEmitter?.ytDlpProcess?.pid}`);
  }
});

setInterval(
  async () => {
    logger.info("Grabbing show schedule");
    const raw = await fetch("https://jkt48.com/calendar/list?lang=id");
    const data = await raw.text();
    await writeFile("public/calendar.html", data);
  },
  1000 * 60 * 60,
);

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
