// Get the party
const partyCode = sessionStorage.getItem("groupCode");
const pHead = document.getElementById("party-code");
const text = "party code: " + partyCode;
pHead.innerHTML = text;

let player;
let setPlayerReady;
const playerReady = new Promise(resolve => setPlayerReady = resolve);
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '390',
    width: '640',
    playerVars: {
      'autoplay': 0,
      'controls': 0,
      'playsinline': 1
    },
    events: {
      onReady: setPlayerReady
    }
  });
}

function loadVideo() {
  const videoUrl = document.getElementById("videoUrl").value;
  const videoId = parseVideoId(videoUrl);
  if (videoId) {
    player.pauseVideo();
    updateVideo(videoId.toString());
    player.cueVideoById(videoId);
  } else {
    alert("Invalid YouTube URL");
  }
}
document.getElementById("loadVideo").addEventListener("click", loadVideo);

function parseVideoId(url) {
  const regex = /(?:\?v=|&v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

let ws;
function connectWebSocket(murl) {
  ws = new WebSocket(murl);

  ws.onopen = () => {
    console.log('WebSocket connection opened');
    sendJoin(partyCode);
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

async function fetchWsUrl() {
  return "wss://7l8uxw0v14.execute-api.us-east-1.amazonaws.com/main";

  const r = await fetch("/api-url");
  apiurl = await r.text();
  return apiurl;
}

async function initWebSocket() {
  const wsUrl = await fetchWsUrl();
  connectWebSocket(wsUrl);
}
initWebSocket();

class VideoState {
  constructor() {
    this.paused = true;
    this.seek = 0;
    this.video = "";
    this.pausedTimestamp = 0;
    this.seekTimestamp = 0;
    this.videoTimestamp = 0;
  }

  // Updates the field, returns true if it was changed (and so needs player update), false otherwise
  updateField(name, value, ts) {
    const tsField = name + "Timestamp";
    if (this[tsField] < ts && this[name] !== value) {
      this[name] = value;
      this[tsField] = ts;
      return true;
    }
    return false;
  }

  updatePaused(paused, ts) {
    if (this.updateField("paused", paused, ts)) {
      if (this.paused) {
        player.pauseVideo();
      } else {
        player.playVideo();
      }
    }
  }

  updateSeek(seek, ts) {
    if (this.updateField("seek", seek, ts)) {
      player.seekTo(seek, true);
    }
  }

  updateVideo(video, ts) {
    if (this.updateField("video", video, ts)) {
      player.loadVideoById(video);
    }
  }
}
const videoState = new VideoState();

async function handleMessage(msg) {
  console.log('Received message:', msg);

  await playerReady;

  const { paused, seek, video, timestamp: ts } = msg;

  // Handle different actions from the server
  switch (msg.action) {
    case 'info':
      videoState.updateVideo(video, ts);
      videoState.updateSeek(seek, ts);
      videoState.updatePaused(paused, ts);
      break;
    case 'paused':
      videoState.updatePaused(paused, ts);
      break;
    case 'seek':
      videoState.updateSeek(seek, ts);
      break;
    case 'video':
      // Update video based on received video ID
      player.loadVideoById(msg.vid);
      videoState.updateVideo(video, ts);
      break;
    default:
      console.warn('Bad message received:', JSON.stringify(msg, null, 2));
  }
}

function sendJoin(partyId) {
  const msg = {
    action: 'join',
    pid: partyId,
  };
  sendWebSocketMessage(msg);
}

function sendPaused(paused) {
  const msg = {
    action: 'paused',
    paused: paused,
  };
  sendWebSocketMessage(msg);
}

function sendSeek(seek) {
  const msg = {
    action: 'seek',
    seek: seek,
  };
  sendWebSocketMessage(msg);
}

function sendVideo(videoId) {
  const msg = {
    action: 'video',
    vid: videoId,
  };
  sendWebSocketMessage(msg);
}
function sendInfo() {
  const msg = {
    action: 'info'
  };
  sendWebSocketMessage(msg);
}

function sendWebSocketMessage(msg) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    console.error('WebSocket is not open:', ws.readyState);
  }
}
