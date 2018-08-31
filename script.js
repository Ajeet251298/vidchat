// Generate random room name if needed
if (!location.hash) {
    location.hash = Math.floor(Math.random() * 0xffffff).toString(16);
}
const roomHash = location.hash.substring(1); 

// TODO: Replace with your own channel ID
const drone = new ScaleDrone("yiS12Ts5RdNhebyM");  
// Room name needs to be prefixed with 'observable-'
const roomName = "observable-" + roomHash;
const configuration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]//this is strun server of google ans storing in config
};

let room;
let pc;

function onSuccess() { }
function onError(error) {
    console.error(error);
}

drone.on("open", error => {  //here open is event ,erro=> means parameter=>{ } 
    if (error) {
        return console.error(error);
    }
    room = drone.subscribe(roomName);  ///this logic is running with 2st person
    room.on("open", error => {
        if (error) {
            onError(error);
        }
    });
    // We're connected to the room and received an array of 'members'
    // connected to the room (including us). Signaling server is ready.
    room.on("members", members => { //how many member is connected
        console.log("MEMBERS", members);
        // If we are the second user to connect to the room we will be creating the offer

        const isOfferer = members.length === 2; //is offerer me 2 ho jayega
        startWebRTC(isOfferer);  //peer to peer connectrion banana stratrt kro.
    });
});

// Send signaling data via Scaledrone
function sendMessage(message) { //issi se codeack eresolution 
    drone.publish({
        room: roomName,
        message
    });
}

function startWebRTC(isOfferer) {
    pc = new RTCPeerConnection(configuration); //config me strun server ka url hai.

    // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
    // message to the other peer through the signaling server
    pc.onicecandidate = event => {
        if (event.candidate) {
            sendMessage({ candidate: event.candidate });
        }
    };

    // If user is offerer let the 'negotiationneeded' event create the offer
    if (isOfferer) { //if 2 peer is connected
        pc.onnegotiationneeded = () => {  
            pc.createOffer()
                .then(localDescCreated)
                .catch(onError);
        };
    }

    // When a remote stream arrives display it in the #remoteVideo element
    pc.ontrack = event => {  //jaise hi video aajeyegi 
        const stream = event.streams[0];
        if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
            remoteVideo.srcObject = stream;
        }
    };

    navigator.mediaDevices
        .getUserMedia({
            audio: true,
            video: true
        })
        .then(stream => {
            // Display your local video in #localVideo element
            localVideo.srcObject = stream;
            // Add your stream to be sent to the conneting peer
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
        }, onError);

    // Listen to signaling data from Scaledrone
    room.on("data", (message, client) => {
        // Message was sent by us
        if (client.id === drone.clientId) {
            return;
        }

        if (message.sdp) {
            let closeBtn = document.querySelector('#closeConnection');
            closeBtn.style.display = 'block';
            let progressBlock = document.querySelector('.progress-block');
            progressBlock.style.display = 'none';
            // This is called after receiving an offer or answer from another peer
            pc.setRemoteDescription(
                new RTCSessionDescription(message.sdp),
                () => {
                    // When receiving an offer lets answer it
                    if (pc.remoteDescription.type === "offer") {
                        pc.createAnswer()
                            .then(localDescCreated)
                            .catch(onError);
                    }
                },
                onError
            );
        } else if (message.candidate) {
            console.log("how are you");
            // Add the new ICE candidate to our connections remote description
            pc.addIceCandidate(
                new RTCIceCandidate(message.candidate),
                onSuccess,
                onError
            );
        }
    });

    document.querySelector("#closeConnection").addEventListener("click", function () {
        pc.close();
    });
}

function localDescCreated(desc) {
    pc.setLocalDescription(desc, () => sendMessage({ sdp: pc.localDescription }),
        onError
    );
}
 