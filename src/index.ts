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
  const channel = env.isProd ? "https://www.youtube.com/@JKT48TV" : "https://www.youtube.com/@LofiGirl";
  const isDownloading = (await readFile("isDownloading", "utf8").catch(() => "")) === "true";
  const url = await readFile("url", "utf8").catch(() => "");
  const ytdlpath = path.resolve(".");
  const ytDlpWrap = new YTDlpWrap(`${ytdlpath}/yt-dlp`);
  const cookiesPath = path.resolve("cookies/cookies");

  if (!url || url === "") {
    logger.info(`Fetching URL for ${channel}`);
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
    }
    await writeFile("url", tempUrl);
    return;
  }

  // check if stream ended
  const m3u8 = await ytDlpWrap.execPromise([url, "-g", "--cookies", cookiesPath]);
  if (!m3u8.trim().endsWith("m3u8")) {
    logger.info("Stream ended. trying to download");
    await writeFile("url", "");
    if (!isDownloading) {
      logger.info("Downloading stream");
      await writeFile("isDownloading", "true");
      await ytDlpWrap
        .execPromise([
          "--live-from-start",
          "--cookies",
          cookiesPath,
          "--merge-output-format",
          "mkv",
          url,
          "-o",
          "video/output.mkv",
        ])
        .catch(async () => {
          await writeFile("isDownloading", "false");
        });
    }
  } else {
    logger.info("Stream still running. Skipping");
  }
});

// cron for every hour
cron.schedule("0 */1 * * *", async () => {
  logger.info("Grabbing show schedule");
  const raw = await fetch("https://jkt48.com/calendar/list?lang=id");
  const data = await raw.text();
  await writeFile("public/calendar.html", data);
});

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
