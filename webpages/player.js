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

async function fetchFunc() {
	r = await fetch("/api-url");
	apiurl = await r.text();
	const webSocketUrl = apiurl;
	const socket = new WebSocket(webSocketUrl);
}

fetchFunc();

socket.addEventListener("open", (event) => {
  console.log("WebSocket connection opened:", event);
});

socket.addEventListener("message", (event) => {
  console.log("Received message from server:", event.data);
  printResponse(event.data);
  sessionStorage.setItem('realCode', event.data); // already joined
});

socket.addEventListener("close", (event) => {
  console.log("WebSocket connection closed:", event);
});

socket.addEventListener("error", (event) => {
  console.error("WebSocket error:", event);
});

function sendMessage(message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(message);
  } else {
    console.error("WebSocket is not open. ReadyState:", socket.readyState);
  }
}

function printResponse(response) {
  console.log("Server response:", response);
}





function addToQueue() {
  const videoUrl = document.getElementById("videoUrl").value;
  const videoId = parseVideoId(videoUrl);
  if (videoId) {
    // Send videoId to the server using WebSocket API to update the queue for all users
    // You can replace the following line with the appropriate WebSocket API call
    updateQueue(videoId);
  } else {
    alert("Invalid YouTube URL");
  }
}

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

// This function simulates updating the queue on the server and all clients
// Replace this with the actual WebSocket API call and event handling
function updateQueue(videoId) {
  const videoQueue = document.getElementById("videoQueue");
  const listItem = document.createElement("li");
  listItem.textContent = `Video ID: ${videoId}`;
  videoQueue.appendChild(listItem);
}

function makeGroup() {
	sendMessage('create');
}

function joinGroup(groupCode) {
	sendMessage('join ' + groupCode);
}