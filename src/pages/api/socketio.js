import { Server } from "socket.io";

export default function SocketHandler(req, res) {
  if (res.socket.server.io) {
  } else {
    const io = new Server(res.socket.server, {
      path: "/api/socketio",
      addTrailingSlash: false,
    });

    res.socket.server.io = io;
    
    // Track active calls: { channelId: { participantCount, startedBy } }
    const activeCalls = new Map();
    
    // Track online users: { userId: socketId }
    const onlineUsers = new Map();

    io.on("connection", (socket) => {
      
      // When a user connects, they should send their user info
      socket.on("user:online", ({ userId, user }) => {
        if (userId) {
          onlineUsers.set(userId, socket.id);
          socket.data.userId = userId;
          socket.data.user = user;
          
          // Broadcast to all clients that this user is now online
          socket.broadcast.emit("user:online", { userId, user });
          
          // Send the new user a list of all currently online users
          const onlineUserIds = Array.from(onlineUsers.keys());
          socket.emit("users:online", onlineUserIds);
          
        }
      });

      socket.on("send_message", (message) => {
        // Broadcast to everyone
        io.emit("receive_message", message);
      });

      socket.on("typing:start", ({ channelId, user }) => {
        if (channelId == null) return;
        const typingUser = user || socket.data.user;
        if (!typingUser) return;
        socket.broadcast.emit("typing:start", {
          channelId,
          user: typingUser,
        });
      });

      socket.on("typing:stop", ({ channelId, userId }) => {
        if (channelId == null) return;
        const resolvedUserId = userId ?? socket.data.user?.id;
        if (resolvedUserId == null) return;
        socket.broadcast.emit("typing:stop", {
          channelId,
          userId: resolvedUserId,
        });
      });

      socket.on("message:edit", (message) => {
        io.emit("message:edit", message);
      });

      socket.on("message:delete", (payload) => {
        io.emit("message:delete", payload);
      });

      socket.on("message:reaction", (payload) => {
        
        if (!payload || !payload.messageId || !payload.channelId) {
          console.error("❌ Invalid reaction payload received:", payload);
          return;
        }
        
        // Broadcast to all connected clients
        io.emit("message:reaction", payload);
      });

      // Video call signaling events
      socket.on("call:join", ({ channelId, user }) => {
        socket.join(`call:${channelId}`);
        socket.data.channelId = channelId;
        socket.data.user = user;
        
        // Check if this is the first participant (call just started)
        io.in(`call:${channelId}`).fetchSockets().then((sockets) => {
          const participantCount = sockets.length;
          const isFirstParticipant = participantCount === 1;
          
          // If this is the first participant, notify all clients that a call started
          if (isFirstParticipant) {
            activeCalls.set(channelId, {
              startedBy: user,
              callType: "video",
              participantCount: 1,
            });
            
            // Broadcast to all connected clients that a call started in this channel
            io.emit("call:started", {
              channelId,
              startedBy: user,
              callType: "video",
            });
          } else {
            // Update participant count
            const callInfo = activeCalls.get(channelId);
            if (callInfo) {
              callInfo.participantCount = participantCount;
            }
          }
          
          // Notify others in the call room about this new participant
          socket.to(`call:${channelId}`).emit("call:user-joined", {
            userId: user?.id || socket.id,
            user,
            socketId: socket.id,
          });

          // Send list of existing participants to the new user
          const participants = sockets
            .filter((s) => s.id !== socket.id && s.data.user)
            .map((s) => ({
              userId: s.data.user.id || s.id,
              user: s.data.user,
              socketId: s.id,
            }));
          socket.emit("call:existing-participants", participants);
        });
      });

      socket.on("call:signal", ({ channelId, targetSocketId, signal }) => {
        // Relay WebRTC signaling data (offer, answer, ICE candidates)
        socket.to(targetSocketId).emit("call:signal", {
          from: socket.data.user,
          fromSocketId: socket.id,
          signal,
        });
      });

      socket.on("call:leave", ({ channelId }) => {
        socket.to(`call:${channelId}`).emit("call:user-left", {
          userId: socket.data.user?.id || socket.id,
          user: socket.data.user,
          socketId: socket.id,
        });
        socket.leave(`call:${channelId}`);
        
        // Check if call is empty and notify all clients
        io.in(`call:${channelId}`).fetchSockets().then((sockets) => {
          const participantCount = sockets.length;
          if (participantCount === 0) {
            // Call ended - no more participants
            activeCalls.delete(channelId);
            io.emit("call:ended", { channelId });
          } else {
            // Update participant count
            const callInfo = activeCalls.get(channelId);
            if (callInfo) {
              callInfo.participantCount = participantCount;
            }
          }
        });
        
        socket.data.channelId = null;
      });

      socket.on("disconnect", () => {
        // Handle call cleanup
        if (socket.data.channelId) {
          const channelId = socket.data.channelId;
          socket.to(`call:${channelId}`).emit("call:user-left", {
            userId: socket.data.user?.id || socket.id,
            user: socket.data.user,
            socketId: socket.id,
          });
          
          // Check if call is empty after disconnect
          io.in(`call:${channelId}`).fetchSockets().then((sockets) => {
            const participantCount = sockets.length;
            if (participantCount === 0) {
              activeCalls.delete(channelId);
              io.emit("call:ended", { channelId });
            } else {
              const callInfo = activeCalls.get(channelId);
              if (callInfo) {
                callInfo.participantCount = participantCount;
              }
            }
          });
        }
        
        // Handle online status cleanup
        const userId = socket.data.userId;
        if (userId && onlineUsers.get(userId) === socket.id) {
          onlineUsers.delete(userId);
          // Broadcast to all clients that this user is now offline
          socket.broadcast.emit("user:offline", { userId, user: socket.data.user });
        }
        
      });
    });
  }
  res.end();
}
