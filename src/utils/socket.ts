import { join } from "path";
import { readdir } from "fs";
import { rm } from "fs/promises";
import { Server } from "socket.io";

const TEMP_DIR = join(__dirname, "..", "..", "temp");
const usersInRoom = new Map<string, string[]>();
const io = new Server({
  path: "/socket.io",
  transports: ["websocket"],
  maxHttpBufferSize: 1e6,
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

  socket.on("notification", (data) => {
    socket.broadcast.in(data.room).emit("notification", data);
  });

  socket.on("disconnect", () => {
    socket.removeAllListeners();
    socket.disconnect();
  });
});

export default io;
