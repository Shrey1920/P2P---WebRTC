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
    assignVideoSlot(userId, stream); // Assign current user a video slot
    socket.emit("join-call");
});

// Assign video slot
function assignVideoSlot(id, stream) {
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

// WebRTC Signaling
socket.on("user-joined", id => {
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
