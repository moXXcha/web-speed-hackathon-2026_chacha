import { promises as fs } from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";

import { Router } from "express";
import httpErrors from "http-errors";
import { v4 as uuidv4 } from "uuid";

import { UPLOAD_PATH } from "@web-speed-hackathon-2026/server/src/paths";

const EXTENSION = "mp4";
const ACCEPTED_FORMATS = new Set(["mp4", "webm", "gif", "mov", "avi", "mkv"]);

export const movieRouter = Router();

movieRouter.post("/movies", async (req, res) => {
  if (req.session.userId === undefined) {
    throw new httpErrors.Unauthorized();
  }
  if (Buffer.isBuffer(req.body) === false) {
    throw new httpErrors.BadRequest();
  }

  const movieId = uuidv4();
  const moviesDir = path.resolve(UPLOAD_PATH, "movies");
  await fs.mkdir(moviesDir, { recursive: true });

  // 一時ファイルに保存
  const tmpInput = path.join(os.tmpdir(), `${movieId}-input`);
  await fs.writeFile(tmpInput, req.body);

  const outputPath = path.resolve(moviesDir, `${movieId}.${EXTENSION}`);

  try {
    // ffmpegで先頭5秒、10fps、正方形クロップ、無音のMP4に変換
    execSync(
      `ffmpeg -i "${tmpInput}" -t 5 -r 10 -vf "crop='min(iw,ih)':'min(iw,ih)'" -b:v 300k -an -movflags faststart -pix_fmt yuv420p -y "${outputPath}"`,
      { stdio: "pipe" },
    );
  } catch {
    await fs.unlink(tmpInput).catch(() => {});
    throw new httpErrors.BadRequest("Failed to convert movie");
  }

  await fs.unlink(tmpInput).catch(() => {});

  return res.status(200).type("application/json").send({ id: movieId });
});
