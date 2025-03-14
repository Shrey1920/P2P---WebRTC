const socket = io();
const peerConnection = new RTCPeerConnection({
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
            urls: "turn:relay1.expressturn.com:3478",
            username: "your_username",
            credential: "your_password"
        }
    ]
});

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localVideo.srcObject = stream;
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
    });

peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
};

peerConnection.onicecandidate = event => {
    if (event.candidate) {
        socket.emit("candidate", event.candidate);
    }
};

socket.on("offer", async offer => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit("answer", answer);
});

socket.on("answer", answer => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("candidate", candidate => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});

async function startCall() {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("offer", offer);
}
