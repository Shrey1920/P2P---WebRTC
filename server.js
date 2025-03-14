const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));

let users = {};

io.on("connection", socket => {
    console.log("New user connected:", socket.id);
    users[socket.id] = socket.id;
    socket.broadcast.emit("user-joined", socket.id);

    socket.on("offer", ({ offer, to }) => {
        io.to(to).emit("offer", { offer, from: socket.id });
    });

    socket.on("answer", ({ answer, to }) => {
        io.to(to).emit("answer", { answer, from: socket.id });
    });

    socket.on("ice-candidate", ({ candidate, to }) => {
        io.to(to).emit("ice-candidate", { candidate, from: socket.id });
    });

    socket.on("leave-call", () => {
        delete users[socket.id];
        io.emit("user-left", socket.id);
        socket.disconnect();
    });

    socket.on("disconnect", () => {
        delete users[socket.id];
        io.emit("user-left", socket.id);
    });
});

server.listen(3000, () => console.log("Server running on port 3000"));
