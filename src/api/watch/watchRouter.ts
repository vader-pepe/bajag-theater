import type { PathLike } from "node:fs";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
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
    <video id="player" width=500 id="vid1" class="video-js" controls data="{}">
      <source src="/replay/play/${filename}" type="video/mp4">
    </video>
  </section>
  <script src="/js/video.min.js"></script>
  <script>
    var player = videojs('player');
    var raw = fetch('/replay/duration/${filename}').then((raw)=> {
      raw.json().then(data=> {
        // TODO: handle seeks
        player.duration = function() {
          return data.responseObject; // the amount of seconds of video
        }
      })
    });
  </script>
</body>

</html>`;
};

interface PlayParams {
  "0": string; // Matches the wildcard in '/play/*'
}

watchRouter.get("/*", (req, res) => {
  const params = req.params as unknown as PlayParams;
  const replayFolder = params[0];
  const serviceResponse = ServiceResponse.success("Successfully grab file", template(replayFolder));
  return handleServiceResponse(serviceResponse, res, true);
});
