import cors from "cors";
import express from "express";
import bodyparser from "body-parser";

import "./utils/socket";
import FilesRouter from "./routers/files";

const server = express();
const port: number = Number.parseInt(process.env.PORT!) || 8000;

server.use(cors());
server.use(bodyparser.json());
server.use("/files", FilesRouter);

server.listen(port, () => {
  console.log("Server started at port " + port);
});
