import { readFile, writeFile } from "node:fs/promises";
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
  const isDownloading = (await readFile("isDownloading", "utf8").catch(() => "")) === "true";
  let url = await readFile("url", "utf8").catch(() => "");
  const channel = env.isProd ? "https://www.youtube.com/@JKT48TV" : "https://www.youtube.com/@LofiGirl";
  const ytdlpath = path.resolve(".");
  const ytDlpWrap = new YTDlpWrap(`${ytdlpath}/yt-dlp`);
  const cookiesPath = path.resolve("cookies/cookies");

  // Fetch URL if not already set in file
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
      } else {
        logger.info(`URL found: ${tempUrl}`);
        await writeFile("url", tempUrl);
        url = tempUrl; // Update the variable to reflect the new URL
      }
    } catch (error) {
      logger.error("Error fetching live stream URL", error);
    }
  }

  // Check if the stream is still live
  if (url) {
    try {
      const m3u8 = await ytDlpWrap.execPromise([url, "-g", "--cookies", cookiesPath]);

      // If the stream has ended, clear the URL
      if (!m3u8.trim().endsWith("m3u8")) {
        logger.info("Livestream ended. Removing URL");
        await writeFile("url", "");
        url = ""; // Reset the in-memory URL
      }
    } catch (error) {
      logger.error("Error checking stream status", error);
      await writeFile("url", ""); // Clear URL on error
      url = "";
    }
  }

  // Download stream if not already downloading and a URL exists
  if (!isDownloading && url) {
    logger.info("Starting stream download");
    await writeFile("isDownloading", "true"); // Mark downloading state

    try {
      await ytDlpWrap.execPromise([
        "--live-from-start",
        "--cookies",
        cookiesPath,
        "--merge-output-format",
        "mkv",
        url,
        "-o",
        "video/output.mkv",
      ]);
      logger.info("Stream download completed");
    } catch (error) {
      logger.error("Error during stream download", error);
    } finally {
      // Reset state after completion or error
      await writeFile("isDownloading", "false");
      await writeFile("url", "");
    }
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
