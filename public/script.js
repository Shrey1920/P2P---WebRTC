const socket = io();
const videoElements = [
    document.getElementById("video1"),
    document.getElementById("video2"),
    document.getElementById("video3"),
    document.getElementById("video4")
];

let peerConnections = {};
let localStream;

// Get user media
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    assignVideoSlot("self", stream); // Assign local video slot
    socket.emit("join-call");
}).catch(error => {
    console.error("Error accessing media devices:", error);
});

// Assign video slot to users
function assignVideoSlot(id, stream) {
    for (let video of videoElements) {
        if (!video.srcObject || video.dataset.userId === id) { 
            video.srcObject = stream;
            video.dataset.userId = id;
            console.log(`Assigned video slot to ${id}`);
            return;
        }
    }
}

// Remove video slot when user leaves
function removeVideoSlot(id) {
    for (let video of videoElements) {
        if (video.dataset.userId === id) {
            video.srcObject = null;
            video.dataset.userId = "";
            console.log(`Removed video slot for ${id}`);
            break;
        }
    }
}

// WebRTC Signaling for new user joining
socket.on("user-joined", id => {
    if (peerConnections[id]) return; // Prevent duplicate peer connections

    console.log(`New user joined: ${id}`);

    const peerConnection = new RTCPeerConnection();
    peerConnections[id] = peerConnection;

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
        console.log(`Receiving stream from: ${id}`);
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

// Receiving WebRTC offer
socket.on("offer", async ({ offer, from }) => {
    console.log(`Received offer from: ${from}`);

    const peerConnection = new RTCPeerConnection();
    peerConnections[from] = peerConnection;

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
        console.log(`Receiving stream from: ${from}`);
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

// Receiving WebRTC answer
socket.on("answer", ({ answer, from }) => {
    console.log(`Received answer from: ${from}`);
    if (peerConnections[from]) {
        peerConnections[from].setRemoteDescription(new RTCSessionDescription(answer));
    }
});

// Receiving ICE candidates
socket.on("ice-candidate", ({ candidate, from }) => {
    console.log(`Received ICE candidate from: ${from}`);
    if (peerConnections[from]) {
        peerConnections[from].addIceCandidate(new RTCIceCandidate(candidate));
    }
});

// User leaving the call
socket.on("user-left", id => {
    console.log(`User left: ${id}`);
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
    console.log("Left the call");
});
