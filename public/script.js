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

    // Make sure the first video slot is always local stream
    if (videoElements[0]) {
        videoElements[0].srcObject = stream;
        videoElements[0].dataset.userId = "local";
    }

    socket.emit("join-call");
}).catch(error => {
    console.error("Error accessing media devices:", error);
});

// Assign video slot
function assignVideoSlot(id, stream) {
    for (let video of videoElements) {
        if (!video.srcObject) {
            video.srcObject = stream;
            video.dataset.userId = id;
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
            return;
        }
    }
}

// WebRTC Signaling
socket.on("user-joined", id => {
    console.log("User joined:", id);
    if (!userId) return; // Ensure we have a valid userId

    const peerConnection = new RTCPeerConnection();
    peerConnections[id] = peerConnection;

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
        console.log("Receiving video from:", id);
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
    console.log("Received offer from:", from);
    const peerConnection = new RTCPeerConnection();
    peerConnections[from] = peerConnection;

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
        console.log("Receiving video from:", from);
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
    console.log("Received answer from:", from);
    if (peerConnections[from]) {
        peerConnections[from].setRemoteDescription(new RTCSessionDescription(answer));
    }
});

socket.on("ice-candidate", ({ candidate, from }) => {
    console.log("Received ICE candidate from:", from);
    if (peerConnections[from]) {
        peerConnections[from].addIceCandidate(new RTCIceCandidate(candidate));
    }
});

socket.on("user-left", id => {
    console.log("User left:", id);
    if (peerConnections[id]) {
        peerConnections[id].close();
        delete peerConnections[id];
    }
    removeVideoSlot(id);
});

// Leave Call
document.getElementById("leaveCall").addEventListener("click", () => {
    console.log("Leaving call...");
    socket.emit("leave-call");
    for (let id in peerConnections) {
        peerConnections[id].close();
        removeVideoSlot(id);
    }
    peerConnections = {};
    localStream.getTracks().forEach(track => track.stop());
});
