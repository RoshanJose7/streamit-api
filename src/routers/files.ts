import Multer from "multer";
import { join } from "path";
import { mkdir } from "fs/promises";
import { HttpStatusCode } from "axios";
import { Request, Router } from "express";
import { createReadStream, createWriteStream, existsSync } from "fs";

import SockerServer from "../utils/socket";

interface TransferData {
  name: string;
  size: number;
  type: string;
  room: string;
  fileid: string;
  sender: string;
  transferid: string;
}

interface MulterRequest extends Request {
  file: any;
}

const multer = Multer();
const FilesRouter = Router();
const incomingfiles = new Map<string, TransferData>();
const roomfiles = new Map<string, TransferData>();
const TEMP_DIR = join(__dirname, "..", "..", "temp");

FilesRouter.get("/:room/:fileid", (req, res) => {
  const { room, fileid } = req.params;
  const filedata = roomfiles.get(fileid);
  const filename = `${fileid}.${filedata.name.split(".").at(-1)}`;

  const filepath = join(TEMP_DIR, room, filename);

  if (!existsSync(filepath))
    res.status(HttpStatusCode.NotFound).json({
      type: "error",
      error: "File not Found!",
    });

  res.set("Content-Type", filedata.type);

  const readstream = createReadStream(filepath);
  readstream.pipe(res, { end: true });
});

FilesRouter.post("/create", async (req, res) => {
  const filedata: TransferData = req.body;
  const roomdir = join(TEMP_DIR, filedata.room);
  incomingfiles.set(filedata["transferid"], filedata);

  if (!existsSync(roomdir)) await mkdir(roomdir);

  res.json({
    type: "message",
    message: "File Created!",
  });
});

FilesRouter.post("/part", multer.single("chunk"), (req: MulterRequest, res) => {
  const payload = req.body;
  const filedata: TransferData = incomingfiles.get(payload["transferid"]);
  const filename = `${filedata.fileid}.${filedata.name.split(".").at(-1)}`;

  const path = join(TEMP_DIR, filedata.room, filename);

  const writestream = createWriteStream(path, {
    flags: "a+",
    encoding: "binary",
  });

  writestream.write(req.file.buffer, (err) => {
    writestream.close();

    if (err) {
      console.error(err);

      res.json({
        type: "error",
        error: err,
      });

      return;
    }

    res.json({
      type: "acknowledgement",
      sender: filedata.sender,
      counter: payload["counter"],
      transferid: filedata.transferid,
      percentage: Number.parseInt(payload["percentage"]),
      chunkRecieved: true,
    });

    SockerServer.in(filedata.room).emit("notification", {
      type: "percentage_update",
      data: {
        sender: filedata.sender,
        fileid: filedata.fileid,
        percentage: Number.parseInt(payload["percentage"]),
      },
    });
  });
});

FilesRouter.post("/complete", (req, res) => {
  const payload = req.body;
  const filedata: TransferData = incomingfiles.get(payload["transferid"]);
  const filename = `${filedata.fileid}.${filedata.name.split(".").at(-1)}`;

  const path = join(TEMP_DIR, filedata.room, filename);
  const writestream = createWriteStream(path, {
    flags: "a+",
    encoding: "binary",
  });

  writestream.end();
  writestream.close();

  SockerServer.in(filedata.room).emit("notification", {
    type: "percentage_update",
    data: {
      fileid: filedata.fileid,
      percentage: 100,
    },
  });

  SockerServer.in(filedata.room).emit("notification", {
    type: "new_file",
    data: filedata,
  });

  roomfiles.set(filedata.fileid, filedata);
  incomingfiles.delete(payload["transferid"]);

  res.json({
    type: "message",
    message: "File Saved!",
  });
});

export default FilesRouter;
