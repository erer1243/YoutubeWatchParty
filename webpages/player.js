//player.js
groupCode = sessionStorage.getItem("groupCode");
// 2. This code loads the IFrame Player API code asynchronously.
var tag = document.createElement('script');

tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// 3. This function creates an <iframe> (and YouTube player)
//    after the API code downloads.
var player;
function onYouTubeIframeAPIReady() {
  player = new YT.Player('existing-iframe-example', {
    //height: '390',
    //width: '640',
    //videoId: 'M7lc1UVf-VE',
    playerVars: {
      //'autoplay': 1, // cant tell if i want this line or not
      'controls': 1,
      'playsinline': 1
    },
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

// 4. The API will call this function when the video player is ready.
function onPlayerReady(event) {
  document.getElementById('existing-iframe-example').style.borderColor = '#FF6D00';
  //event.target.playVideo();
}
function onPlayerStateChange(event) {
  console.log(event.data);
  changeBorderColor(event.data);
  switch (event.data) {

    case YT.PlayerState.ENDED:

      break;
    case YT.PlayerState.PLAYING:
      togglePaused(false);
      break;
    case YT.PlayerState.PAUSED:
      togglePaused(true);

      break;
    case YT.PlayerState.BUFFERING:

      break;
    case YT.PlayerState.CUED:
      sendInfo();
      break;
    default:
      console.warn("Error 7");
  }
}

function changeBorderColor(playerStatus) {
  var color;
  if (playerStatus == -1) {
    color = "#37474F"; // unstarted = gray
  } else if (playerStatus == 0) {
    color = "#FFFF00"; // ended = yellow
  } else if (playerStatus == 1) {
    color = "#33691E"; // playing = green
  } else if (playerStatus == 2) {
    color = "#DD2C00"; // paused = red
  } else if (playerStatus == 3) {
    color = "#AA00FF"; // buffering = purple
  } else if (playerStatus == 5) {
    color = "#FF6D00"; // video cued = orange
  }
  if (color) {
    document.getElementById('existing-iframe-example').style.borderColor = color;
  }
}

document.getElementById("loadVideo").addEventListener("click", loadVideo);

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

function parseVideoId(url) {
  const regex = /(?:\?v=|&v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

var ws;

function connectWebSocket(murl) {
  ws = new WebSocket(murl);

  ws.onopen = () => {
    console.log('WebSocket connection opened');
    joinParty(groupCode);
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
      if (msg.paused == true) {
        player.pauseVideo();
      } else if (msg.paused == false) {
        player.playVideo();
      }
      // Update pause/play status based on received status
      break;
    case 'seek':
      // Update seek time based on received seek time
      break;
    case 'video':
      // Update video based on received video ID
      player.loadVideoById(msg.vid);
      break;
    default:
      console.warn('Unknown action received:', msg.action);
      console.warn('The msg received:', msg);
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
