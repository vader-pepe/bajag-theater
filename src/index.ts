import cron from 'node-cron';
import { exec } from "child_process";
import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";

const server = app.listen(env.PORT, () => {
  const { NODE_ENV, HOST, PORT } = env;
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

// Schedule job from 18:45 to 19:00 Monday to Friday
cron.schedule('45-59 18 * * 1-5', () => {
  exec('sh script.sh',
    (error, stdout, stderr) => {
      console.log(stdout);
      console.log(stderr);
      if (error !== null) {
        console.log(`exec error: ${error}`);
      }
    });
});

// Schedule job from 14:00 to 19:00 Saturday and Sunday
cron.schedule('0-59 14-19 * * 6,7', () => {
  exec('sh script.sh',
    (error, stdout, stderr) => {
      console.log(stdout);
      console.log(stderr);
      if (error !== null) {
        console.log(`exec error: ${error}`);
      }
    });
});

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
