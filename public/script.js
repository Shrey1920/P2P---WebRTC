const socket = io();
const videoElements = [document.getElementById("video1"), 
                       document.getElementById("video2"), 
                       document.getElementById("video3"), 
                       document.getElementById("video4")];

let peerConnections = {};
let localStream;
let userId;

// Get user media
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    socket.emit("join-call"); // First, notify the server
});

// Assign video slot
function assignVideoSlot(id, stream) {
    if (id === userId) return; // Prevent duplicate assignment of self
    
    for (let video of videoElements) {
        if (!video.srcObject) {
            video.srcObject = stream;
            video.dataset.userId = id;
            break;
        }
    }
}

// Remove video slot when user leaves
function removeVideoSlot(id) {
    for (let video of videoElements) {
        if (video.dataset.userId === id) {
            video.srcObject = null;
            video.dataset.userId = "";
            break;
        }
    }
}

// Set userId when joining
socket.on("your-id", id => {
    userId = id;
    assignVideoSlot(userId, localStream); // Now assign local video
});

// WebRTC Signaling
socket.on("user-joined", id => {
    if (id === userId) return; // Don't create a peer connection for yourself

    const peerConnection = new RTCPeerConnection();
    peerConnections[id] = peerConnection;

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
        assignVideoSlot(id, event.streams[0]);
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit("ice-candidate", { candidate: event.candidate, to: id });
        }
    };

    peerConnection.createOffer().then(offer => {
        peerConnection.setLocalDescription(offer);
        socket.emit("offer", { offer, to: id });
    });
});

socket.on("offer", async ({ offer, from }) => {
    if (from === userId) return; // Ignore offers from yourself

    const peerConnection = new RTCPeerConnection();
    peerConnections[from] = peerConnection;

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
        assignVideoSlot(from, event.streams[0]);
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit("ice-candidate", { candidate: event.candidate, to: from });
        }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", { answer, to: from });
});

socket.on("answer", ({ answer, from }) => {
    peerConnections[from].setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice-candidate", ({ candidate, from }) => {
    peerConnections[from].addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on("user-left", id => {
    if (peerConnections[id]) {
        peerConnections[id].close();
        delete peerConnections[id];
    }
    removeVideoSlot(id);
});

// Leave Call
document.getElementById("leaveCall").addEventListener("click", () => {
    socket.emit("leave-call");
    for (let id in peerConnections) {
        peerConnections[id].close();
        removeVideoSlot(id);
    }
    peerConnections = {};
    localStream.getTracks().forEach(track => track.stop());
});
