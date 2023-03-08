import { join } from "path";
import { readdir } from "fs";
import { rm } from "fs/promises";
import { Server, Socket } from "socket.io";

import { TransferData } from "./constants";

const senderSockets = new Map<string, Socket>();
const usersInRoom = new Map<string, string[]>();
const roomFiles = new Map<string, TransferData>();
const incomingFiles = new Map<string, TransferData>();
const TEMP_DIR = join(__dirname, "..", "..", "temp");

const io = new Server({
  path: "/socket.io",
  transports: ["websocket"],
  maxHttpBufferSize: 1e6,
  cors: {
    origin: "*",
  }
});

io.on("connection", (socket) => {
  socket.on("join_room", (data) => {
    if (usersInRoom.has(data.room)) {
      const users: string[] = usersInRoom.get(data.room)!;
      usersInRoom.set(data.room, [...users, socket.id]);
    } else usersInRoom.set(data.room, [socket.id]);

    socket.join([data.room]);
    io.in(data.room).emit("notification", {
      type: "log",
      notification: `${data.name} joined ${data.room}`,
    });
  });

  socket.on("leave_room", (data) => {
    if (!usersInRoom.has(data.room)) usersInRoom.delete(data.room);
    socket.leave(data.room);

    const users = usersInRoom.get(data.room);

    if (users.length === 0) {
      const room_dir = join(TEMP_DIR, data.room);

      readdir(room_dir, async (err, files) => {
        if (err) console.error(err);
        else {
          for (let i = 0; i < files.length; i++) {
            const file_path = join(room_dir, files[i]);
            await rm(file_path);
          }
        }
      });
    }

    io.in(data.room).emit("notification", {
      type: "log",
      notification: `${data.name} left ${data.room}`,
    });
  });

  socket.on("file_create", (data: TransferData) => {
    incomingFiles.set(data["transferid"], data);
    senderSockets.set(data.sender, socket);

    socket.broadcast.to(data.room).emit("notification", {
      type: "new_file",
      data,
    });

    console.log("Percentage: 0");
    console.log(`TimeStamp: ${Date.now()}`);

    socket.emit("ack_file_create", data.transferid);
  });

  socket.on("file_part", (data) => {
    const filedata: TransferData = incomingFiles.get(data["transferid"]);

    socket.broadcast.to(filedata.room).emit("file_part_recv", {
      counter: data["counter"],
      chunk: data["chunk"],
    });

    io.in(filedata.room).emit("notification", {
      type: "percentage_update",
      data: {
        sender: filedata.sender,
        fileid: filedata.fileid,
        percentage: Number.parseInt(data["percentage"]),
      },
    });

    console.log(`Percentage: ${data["percentage"]}`);
    console.log(`TimeStamp: ${Date.now()}`);

    socket.emit("ack_file_part", { ...data, chunkReceived: true });
  });

  socket.on("file_complete", (data) => {
    const filedata: TransferData = incomingFiles.get(data["transferid"]);

    io.in(filedata.room).emit("notification", {
      type: "percentage_update",
      data: {
        fileid: filedata.fileid,
        percentage: 100,
      },
    });

    socket.broadcast.to(filedata.room).emit("notification", {
      type: "new_file_received",
      data: filedata,
    });

    console.log("Percentage: 100");
    console.log(`TimeStamp: ${Date.now()}`);

    roomFiles.set(filedata.fileid, filedata);
    incomingFiles.delete(data["transferid"]);
  });

  socket.on("notification", (data) => {
    socket.broadcast.to(data.payload.room).emit("notification", data);
  });

  socket.on("disconnect", () => {
    socket.removeAllListeners();
    socket.disconnect();
  });
});

export default io;
