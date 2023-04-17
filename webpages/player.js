const now = () => new Date().getTime();

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

  // Track current time in player
  const iframeWindow = player.getIframe().contentWindow;
  window.addEventListener("message", ev => {
    if (ev.source !== iframeWindow) return;
    const data = JSON.parse(ev.data);
    if (data.event === "infoDelivery" && data?.info?.currentTime) {
      setCurrentTimeFromPlayer(Math.floor(data.info.currentTime));
    }
  })
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

  // Updates the field if the timestamp is newer
  updateField(name, value, ts) {
    ts = ts !== undefined ? ts : now();
    const tsField = name + "Timestamp";
    if (this[tsField] < ts) {
      this[name] = value;
      this[tsField] = ts;
    }
  }

  updatePaused(paused, ts) {
    this.updateField("paused", paused, ts);
    if (this.paused) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
    setPauseButton(this.paused);
  }

  updateSeek(seek, ts) {
    this.updateField("seek", seek, ts)
    player.seekTo(seek, true);

    // Sometimes the yt api unpauses when seeking
    videoState.updatePaused(this.paused);
  }

  updateVideo(video, ts) {
    this.updateField("video", video, ts)
    player.cueVideoById(video);

    // Unfortunately youtube doesn't provide a trigger for being loaded, so we need to poll
    // This adapts it to a promise we can await
    let setReady;
    this.newVideoReady = new Promise(resolve => setReady = resolve);
    const checkReady = async () => {
      // dur is a marker of metadata being loaded
      const dur = player.getDuration();
      if (dur) setReady();
      else setTimeout(checkReady, 150);
    }
    checkReady();

    // Use newVideoReady to set the duration text
    // and to restore paused state, since loading a new video changes this
    (async () => {
      await this.newVideoReady;
      setTotalTimeText(player.getDuration());
      videoState.updatePaused(videoState.paused);
    })();
  }
}
const videoState = new VideoState();

async function handleMessage(msg) {
  console.log('Received message:', msg);
  await playerReady;

  // Handle different actions from the server
  const { paused, seek, video, timestamp: ts } = msg;
  switch (msg.action) {
    case 'info':
      videoState.updateVideo(video, ts);
      await videoState.newVideoReady;
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

const ael = (ev, id, fn) => document.getElementById(id).addEventListener(ev, fn);

const parseVideoId = url => {
  const regex = /(?:\?v=|&v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

ael("click", "load-video", () => {
  const videoUrl = document.getElementById("video-url").value;
  const videoId = parseVideoId(videoUrl);
  if (videoId) {
    sendVideo(videoId);
    videoState.updateVideo(videoId);
  } else {
    alert("Invalid YouTube URL");
  }
})

ael("click", "pause-play-btn", ev => {
  const paused = !videoState.paused;
  videoState.updatePaused(paused);
  sendPaused(paused);
  setPauseButton(paused);
});

ael("input", "volume-control", ev => {
  const vol = Number(ev.target.value);
  player.setVolume(Math.max(Math.min(vol, 100), 0));
});

const getSeekBarTime = () => {
  const dur = player.getDuration();
  const bar = document.getElementById("seek-bar");
  return Math.floor(dur * (bar.value / 100));
}

let draggingSeek = false;
ael("input", "seek-bar", () => setCurrentTimeText(getSeekBarTime()));
ael("mousedown", "seek-bar", () => draggingSeek = true);
ael("mouseup", "seek-bar", () => {
  draggingSeek = false;
  const seekTime = getSeekBarTime();
  videoState.updateSeek(seekTime);
  sendSeek(seekTime);
});

const formatTime = seconds => {
  const min = Math.floor(seconds / 60);
  const rem = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
}

const initVolumeBar = async () => {
  await playerReady;
  const vol = Math.max(Math.min(Math.floor(player.getVolume()), 100), 0);
  document.getElementById("volume-control").value = vol;
}
initVolumeBar();

const setPauseButton = paused =>
  document.getElementById("pause-play-btn").innerText = paused ? "Play" : "Pause";

const setCurrentTimeText = seconds =>
  document.getElementById("current-time").textContent = formatTime(seconds);

const setTotalTimeText = seconds =>
  document.getElementById("total-time").textContent = formatTime(seconds);

const setCurrentTimeFromPlayer = (seconds) => {
  if (draggingSeek) return;
  setCurrentTimeText(seconds);

  const dur = player.getDuration();
  const time = String(Math.floor(100 * seconds / dur));
  document.getElementById("seek-bar").value = time;
};
