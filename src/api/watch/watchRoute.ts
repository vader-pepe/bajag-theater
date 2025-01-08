import type { PathLike } from "node:fs";
import path from "node:path";
import express, { type Router } from "express";

export const watchRouter: Router = express.Router();

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

interface PlayParams {
  "0": string; // Matches the wildcard in '/play/*'
}

watchRouter.get("/*", (req, res) => {
  const params = req.params as unknown as PlayParams;
  const replayFolder = params[0];
  return res.send(template(replayFolder));
});
