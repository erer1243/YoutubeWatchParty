let player;

//window.onload = localStorage.getItem("groupCode");

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '390',
    width: '640',
    videoId: 'M7lc1UVf-VE',
    events: {
      'onStateChange': onPlayerStateChange
    }
  });

  const iframeWindow = player.getIframe().contentWindow;
  window.addEventListener("message", ev => {
    if (ev.source !== iframeWindow) return;
    const data = JSON.parse(ev.data);
    if (data.event === "infoDelivery" && data?.info?.currentTime) {
      console.log("INFO:", data.info);
    }
  })
}

document.getElementById("loadVideo").addEventListener("click", loadVideo);
document.getElementById("addToQueue").addEventListener("click", addToQueue);

function loadVideo() {
  const videoUrl = document.getElementById("videoUrl").value;
  const videoId = parseVideoId(videoUrl);
  if (videoId) {
    player.loadVideoById(videoId);
  } else {
    alert("Invalid YouTube URL");
  }
}
//
var ws;

function connectWebSocket(murl) {
  ws = new WebSocket(murl);

  ws.onopen = () => {
    console.log('WebSocket connection opened');
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed');
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function handleMessage(msg) {
  console.log('Received message:', msg);

  // Handle different actions from the server
  switch (msg.action) {
    case 'info':
      // Update video, pause/play status, and seek time based on received info
      break;
    case 'paused':
      // Update pause/play status based on received status
      break;
    case 'seek':
      // Update seek time based on received seek time
      break;
    case 'video':
      // Update video based on received video ID
      break;
    default:
      console.warn('Unknown action received:', msg.action);
  }
}

function joinParty(partyId) {
  const msg = {
    action: 'join',
    pid: partyId,
  };
  sendWebSocketMessage(msg);
}

function togglePaused(paused) {
  const msg = {
    action: 'paused',
    paused: paused,
  };
  sendWebSocketMessage(msg);
}

function updateSeek(seek) {
  const msg = {
    action: 'seek',
    seek: seek,
  };
  sendWebSocketMessage(msg);
}

function updateVideo(videoId) {
  const msg = {
    action: 'video',
    vid: videoId,
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

async function fetchFunc() {
  try {
    r = await fetch("/api-url");
    apiurl = await r.text();
    return apiurl;
  } catch (error) {
    console.error("Error fetching API URL:", error);
    return null;
  }
} // Replace 'YOUR_WEBSOCKET_URL' with your WebSocket API URL
async function initWebSocket() {
  try {
    const daUrl = await fetchFunc();
    connectWebSocket(daUrl);
  } catch (error) {
    console.error(error);
  }
}

initWebSocket();

function parseVideoId(url) {
  const regex = /(?:\?v=|&v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function onPlayerStateChange(event) {
  console.log(event);
  // Send the appropriate function calls using WebSocket API when pausing or playing
  if (event.data === YT.PlayerState.PLAYING) {
    // Send play event using WebSocket API
  } else if (event.data === YT.PlayerState.PAUSED) {
    // Send pause event using WebSocket API
  }
}
