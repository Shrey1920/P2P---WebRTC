const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCall = document.getElementById('startCall');

let localStream;
let peerConnection;
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// WebSocket Signaling
const socket = new WebSocket(`ws://${window.location.host}`);

socket.onmessage = async (event) => {
    const message = JSON.parse(event.data);

    if (message.offer) {
        await handleOffer(message.offer);
    } else if (message.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
    } else if (message.iceCandidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(message.iceCandidate));
    }
};

// Start Call
startCall.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({ iceCandidate: event.candidate }));
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({ offer }));
};

// Handle Offer
async function handleOffer(offer) {
    peerConnection = new RTCPeerConnection(config);
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({ iceCandidate: event.candidate }));
        }
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.send(JSON.stringify({ answer }));
}
