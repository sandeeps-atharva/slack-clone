import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import {
  addParticipant,
  removeParticipant,
  updateParticipantStream,
  setConnectionError,
} from "../store/slices/callSlice";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function usePeerConnections(socket, localStream, callChannelId, currentUser) {
  const dispatch = useDispatch();
  const peerConnectionsRef = useRef({});
  const socketIdMapRef = useRef({}); // Maps userId to socketId
  const isNegotiatingRef = useRef({}); // Track if we're in the middle of negotiation
  console.log("peerConnectionsRef",peerConnectionsRef);
  

  // Helper function to create a peer connection
  const createPeerConnection = (userId, user, socketId, isInitiator = false) => {
    // Don't create duplicate connections
    if (peerConnectionsRef.current[userId]) {
      return peerConnectionsRef.current[userId];
    }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    console.log("pc",pc);
    

    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketIdMapRef.current[userId]) {
        socket.emit("call:signal", {
          channelId: callChannelId,
          targetSocketId: socketIdMapRef.current[userId],
          signal: {
            type: "ice-candidate",
            candidate: event.candidate,
          },
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      dispatch(
        addParticipant({
          userId,
          user,
          stream: remoteStream,
        })
      );
      dispatch(
        updateParticipantStream({
          userId,
          stream: remoteStream,
        })
      );
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        // Try to restart ICE
        pc.restartIce();
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "closed") {
        dispatch(setConnectionError(`Connection ${pc.connectionState} with ${user?.username || userId}`));
      }
    };

    peerConnectionsRef.current[userId] = pc;
    socketIdMapRef.current[userId] = socketId;

    return pc;
  };

  // Helper function to create and send an offer
  const createAndSendOffer = (userId, pc) => {
    if (isNegotiatingRef.current[userId]) {
      return;
    }

    isNegotiatingRef.current[userId] = true;

    pc.createOffer()
      .then((offer) => {
        return pc.setLocalDescription(offer);
      })
      .then(() => {
        const targetSocketId = socketIdMapRef.current[userId];
        if (targetSocketId) {
          socket.emit("call:signal", {
            channelId: callChannelId,
            targetSocketId: targetSocketId,
            signal: {
              type: "offer",
              offer: pc.localDescription,
            },
          });
        } else {
          console.error(`No socket ID found for ${userId}`);
        }
      })
      .catch((err) => {
        console.error("Error creating offer:", err);
        dispatch(setConnectionError("Failed to create offer"));
      })
      .finally(() => {
        isNegotiatingRef.current[userId] = false;
      });
  };

  useEffect(() => {
    if (!socket || !callChannelId || !currentUser?.id) return;

    // When a new user joins the call, existing participants create an offer
    const handleUserJoined = ({ userId, user, socketId }) => {
      if (userId === currentUser.id) return;

      // Create peer connection (we're the existing participant, so we'll create an offer)
      const pc = createPeerConnection(userId, user, socketId, false);
      
      // Wait a bit for the connection to be ready, then create offer
      // Use setTimeout to ensure the connection is fully set up
      setTimeout(() => {
        if (peerConnectionsRef.current[userId] && peerConnectionsRef.current[userId].signalingState === "stable") {
          createAndSendOffer(userId, pc);
        }
      }, 100);
    };

    const handleUserLeft = ({ userId }) => {
      const pc = peerConnectionsRef.current[userId];
      if (pc) {
        pc.close();
        delete peerConnectionsRef.current[userId];
      }
      delete socketIdMapRef.current[userId];
      dispatch(removeParticipant(userId));
    };

    const handleSignal = ({ from, fromSocketId, signal }) => {
      const userId = from?.id;
      if (!userId || userId === currentUser.id) return;

      let pc = peerConnectionsRef.current[userId];

      if (signal.type === "offer") {
        // Received an offer - we need to create an answer
        
        if (!pc) {
          // Create peer connection if it doesn't exist (we're the new joiner)
          pc = createPeerConnection(userId, from, fromSocketId, false);
        }

        // Check if we're already in the process of handling this offer
        if (isNegotiatingRef.current[userId]) {
          return;
        }

        // If we already have a remote description and local description, connection is established
        if (pc.remoteDescription && pc.localDescription) {
          return;
        }

        // If we're in a state that doesn't allow setting remote description, check what to do
        const currentState = pc.signalingState;
        if (currentState === "have-local-offer" || currentState === "have-local-pranswer") {
          // We're waiting for an answer, but received an offer - this is a conflict
          // This shouldn't happen in normal flow, but handle it gracefully
          return;
        }

        // Double-check: if we already have both descriptions, connection is established
        if (pc.remoteDescription && pc.localDescription) {
          return;
        }

        isNegotiatingRef.current[userId] = true;

        // Set remote description and create answer
        pc.setRemoteDescription(new RTCSessionDescription(signal.offer))
          .then(() => {
            // Process any queued ICE candidates
            if (pc.queuedCandidates && pc.queuedCandidates.length > 0) {
              pc.queuedCandidates.forEach((candidate) => {
                pc.addIceCandidate(candidate).catch((err) => {
                  console.error("Error adding queued ICE candidate:", err);
                });
              });
              pc.queuedCandidates = [];
            }
            return pc.createAnswer();
          })
          .then((answer) => {
            return pc.setLocalDescription(answer);
          })
          .then(() => {
            socket.emit("call:signal", {
              channelId: callChannelId,
              targetSocketId: fromSocketId,
              signal: {
                type: "answer",
                answer: pc.localDescription,
              },
            });
          })
          .catch((err) => {
            console.error("Error handling offer:", err.message || err);
            const errorMessage = err.message || err.toString();
            if (errorMessage.includes("Called in wrong state") || errorMessage.includes("InvalidStateError")) {
              
              // If we're in stable state with both descriptions, connection is established
              if (pc.signalingState === "stable" && pc.remoteDescription && pc.localDescription) {
                // Connection is good, just clear the negotiating flag
                isNegotiatingRef.current[userId] = false;
                return;
              }
              
              // If we have remote but no local, try to create answer
              if (pc.remoteDescription && !pc.localDescription && pc.signalingState === "have-remote-offer") {
                pc.createAnswer()
                  .then((answer) => pc.setLocalDescription(answer))
                  .then(() => {
                    socket.emit("call:signal", {
                      channelId: callChannelId,
                      targetSocketId: fromSocketId,
                      signal: {
                        type: "answer",
                        answer: pc.localDescription,
                      },
                    });
                  })
                  .catch((err2) => {
                    console.error("Error creating answer on retry:", err2);
                    dispatch(setConnectionError(`Failed to establish connection with ${from?.username || userId}`));
                  })
                  .finally(() => {
                    isNegotiatingRef.current[userId] = false;
                  });
                return;
              }
              
              dispatch(setConnectionError(`Connection state error with ${from?.username || userId}`));
            } else {
              dispatch(setConnectionError("Failed to handle connection"));
            }
          })
          .finally(() => {
            // Only clear if we didn't already handle it in catch
            if (isNegotiatingRef.current[userId] !== false) {
              isNegotiatingRef.current[userId] = false;
            }
          });
      } else if (signal.type === "answer") {
        // Received an answer to our offer
        if (!pc) {
          console.error(`No peer connection found for ${userId} when receiving answer`);
          return;
        }

        // If we already have a remote description, this might be a duplicate answer
        if (pc.remoteDescription) {
          // If we're in stable state with both descriptions, connection is established
          if (pc.signalingState === "stable" && pc.localDescription) {
            return;
          }
        }

        // Check if we're in a state that can accept an answer
        const currentState = pc.signalingState;
        if (currentState === "have-local-offer" || currentState === "have-local-pranswer") {
          pc.setRemoteDescription(new RTCSessionDescription(signal.answer))
            .then(() => {
              // Process any queued ICE candidates
              if (pc.queuedCandidates && pc.queuedCandidates.length > 0) {
                pc.queuedCandidates.forEach((candidate) => {
                  pc.addIceCandidate(candidate).catch((err) => {
                    console.error("Error adding queued ICE candidate:", err);
                  });
                });
                pc.queuedCandidates = [];
              }
            })
            .catch((err) => {
              console.error("Error setting remote answer:", err.message || err);
              const errorMessage = err.message || err.toString();
              if (errorMessage.includes("Called in wrong state") || errorMessage.includes("InvalidStateError")) {
                // If connection is already established, ignore the error
                if (pc.signalingState === "stable" && pc.remoteDescription && pc.localDescription) {
                } else if (pc.connectionState === "connected" || pc.connectionState === "connecting") {
                } else {
                }
              }
            });
        } else {
        }
      } else if (signal.type === "ice-candidate") {
        // Received ICE candidate
        if (pc && signal.candidate) {
          // Only add ICE candidates if we have set remote description
          if (pc.remoteDescription || pc.localDescription) {
            pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
              .catch((err) => {
                console.error("Error adding ICE candidate:", err);
                // If adding candidate fails, it might be because we're in the wrong state
                // Queue it for later
                if (!pc.remoteDescription && !pc.localDescription) {
                }
              });
          } else {
            // Queue the candidate
            // Store candidate and add it later when description is set
            if (!pc.queuedCandidates) {
              pc.queuedCandidates = [];
            }
            pc.queuedCandidates.push(new RTCIceCandidate(signal.candidate));
          }
        }
      }
    };

    const handleExistingParticipants = (participants) => {
      // When we receive existing participants, we're the NEW joiner
      // We should NOT create offers - we wait for offers from existing participants
      // Just store the socket IDs so we can respond to their offers
      participants.forEach((participant) => {
        const { userId, user, socketId } = participant;
        if (userId === currentUser.id) return;
        
        // Store the socket ID, but don't create connection yet
        // The existing participants will send us offers via handleSignal
        socketIdMapRef.current[userId] = socketId;
      });
    };

    socket.on("call:user-joined", handleUserJoined);
    socket.on("call:user-left", handleUserLeft);
    socket.on("call:signal", handleSignal);
    socket.on("call:existing-participants", handleExistingParticipants);

    return () => {
      socket.off("call:user-joined", handleUserJoined);
      socket.off("call:user-left", handleUserLeft);
      socket.off("call:signal", handleSignal);
      socket.off("call:existing-participants", handleExistingParticipants);

      // Cleanup peer connections
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        pc.close();
      });
      peerConnectionsRef.current = {};
      socketIdMapRef.current = {};
      isNegotiatingRef.current = {};
    };
  }, [socket, localStream, callChannelId, currentUser, dispatch]);

  // Update local stream tracks when stream changes
  useEffect(() => {
    if (!localStream) return;

    Object.values(peerConnectionsRef.current).forEach((pc) => {
      const senders = pc.getSenders();
      const currentTracks = new Set(
        senders.map((sender) => sender.track).filter((track) => track !== null)
      );

      localStream.getTracks().forEach((track) => {
        if (!currentTracks.has(track)) {
          const sender = senders.find((s) => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track);
          } else {
            pc.addTrack(track, localStream);
          }
        }
      });
    });
  }, [localStream]);

  return peerConnectionsRef.current;
}

