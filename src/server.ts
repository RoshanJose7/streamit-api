import cors from "cors";
import { join } from "path";
import express from "express";
import { createServer } from "http";
import bodyparser from "body-parser";

import io from "./utils/socket";
import FilesRouter from "./routers/files";

const app = express();
const server = createServer(app);
const port = process.env.PORT || 8080;

app.use(cors());
app.use(bodyparser.json());
app.use(express.static(join(__dirname, "..", "public")));

app.use("/files", FilesRouter);

io.listen(server);
server.listen(port, () => {
  console.log("Server started at port " + port);
});
