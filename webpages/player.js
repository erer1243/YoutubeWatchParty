let player;

window.onload = localStorage.getItem("groupCode");

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
