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
	player = new YT.Player('player', {
		height: '390',
		width: '640',
		videoId: 'M7lc1UVf-VE',
		playerVars: {
			'playsinline': 1
		},
		events: {
			'onReady': onPlayerReady,
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

// 4. The API will call this function when the video player is ready.
function onPlayerReady(event) {
	//event.target.playVideo();
}
function onPlayerStateChange(event) {
	console.log(event.data);
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
		
			break;
		default:
			console.warn("Error 7");
	}
}
// 5. The API calls this function when the player's state changes.
//    The function indicates that when playing a video (state=1),
//    the player should play for six seconds and then stop.
var done = false;/*
function onPlayerStateChange(event) {
	if (event.data == YT.PlayerState.PLAYING && !done) {
		setTimeout(stopVideo, 6000);
		done = true;
	}
}*/
function stopVideo() {
	player.stopVideo();
}

document.getElementById("loadVideo").addEventListener("click", loadVideo);
document.getElementById("addToQueue").addEventListener("click", addToQueue);

function loadVideo() {
  const videoUrl = document.getElementById("videoUrl").value;
  const videoId = parseVideoId(videoUrl);
  if (videoId) {
	player.pauseVideo();
	updateVideo(videoId.toString());
    player.cueVideoById(videoId);
    //updateVideo(videoId);
  } else {
    alert("Invalid YouTube URL");
  }
}

function addToQueue() {
  const videoUrl = document.getElementById("videoUrl").value;
  //const videoId = parseVideoId(videoUrl);
  if (videoUrl) {
    // Send videoId to the server using WebSocket API to update the queue for all users
    // You can replace the following line with the appropriate WebSocket API call
    updateQueue(videoUrl);
  } else {
    alert("Invalid YouTube URL");
  }
}

function parseVideoId(url) {
  const regex = /(?:\?v=|&v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
/*
function onPlayerStateChange(event) {
  console.log(event);
  // Send the appropriate function calls using WebSocket API when pausing or playing
  if (event.data === YT.PlayerState.PLAYING) {
    // Send play event using WebSocket API
  } else if (event.data === YT.PlayerState.PAUSED) {
    // Send pause event using WebSocket API
  }
}*/

// This function simulates updating the queue on the server and all clients
// Replace this with the actual WebSocket API call and event handling
function updateQueue(videoId) {
  const videoQueue = document.getElementById("videoQueue");
  const listItem = document.createElement("li");
  listItem.textContent = `Video ID: ${videoId}`;
  videoQueue.appendChild(listItem);
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
