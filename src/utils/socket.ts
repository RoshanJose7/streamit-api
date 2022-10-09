import { Server } from "socket.io";

const usersInRoom = new Map<string, string[]>();
const port: number = Number.parseInt(process.env.SOCKET_PORT!) || 8001;
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

io.listen(port);
console.log("Websockets server started at port " + port);

export default io;
