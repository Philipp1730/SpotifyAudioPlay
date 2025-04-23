// --- Spotify OAuth + PKCE ---
const clientId = "a727fe020d254b26a32d982d998d0126"; // Ersetze das mit deiner Client-ID
const redirectUri = "https://philipp1730.github.io/SpotifyAudioPlay/";

let codeVerifier;
let accessToken = localStorage.getItem("access_token");

document.addEventListener("DOMContentLoaded", () => {
  // Login Button
  document.getElementById("login-button").addEventListener("click", () => {
    generateCodeVerifier().then(verifier => {
      codeVerifier = verifier;
      const challenge = generateCodeChallenge(codeVerifier);
      localStorage.setItem("code_verifier", codeVerifier);
      const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user-read-playback-state user-modify-playback-state&code_challenge_method=S256&code_challenge=${challenge}`;
      window.location.href = authUrl;
    });
  });

  // Nach Redirect Zugriffstoken holen
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  if (code && !accessToken) {
    fetchAccessToken(code).then(() => {
      window.history.replaceState({}, document.title, "/SpotifyAudioPlay/");
    });
  }

  // Weitere Buttons
  document.getElementById("pause-button")?.addEventListener("click", pause);
  document.getElementById("bookmark-button")?.addEventListener("click", setBookmark);
  document.getElementById("load-bookmarks")?.addEventListener("click", loadBookmarks);
});

// --- Auth Helper ---
function generateCodeVerifier() {
  const array = new Uint32Array(56);
  window.crypto.getRandomValues(array);
  return Promise.resolve(btoa(Array.from(array).map(val => val % 36).join("")).slice(0, 128));
}

function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  return window.crypto.subtle.digest("SHA-256", data).then(buffer => {
    const hashArray = Array.from(new Uint8Array(buffer));
    const base64 = btoa(String.fromCharCode(...hashArray));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  });
}

async function fetchAccessToken(code) {
  const verifier = localStorage.getItem("code_verifier");

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirectUri);
  params.append("code_verifier", verifier);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await res.json();
  accessToken = data.access_token;
  localStorage.setItem("access_token", accessToken);
}

// --- Spotify API Steuerung ---
function pause() {
  fetch("https://api.spotify.com/v1/me/player/pause", {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(console.error);
}

function play(uri, position_ms = 0) {
  fetch("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ context_uri: uri, position_ms }),
  }).catch(console.error);
}

// --- Bookmarks ---
function setBookmark() {
  fetch("https://api.spotify.com/v1/me/player", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
    .then(res => res.json())
    .then(data => {
      if (data && data.context && data.item) {
        const bookmark = {
          uri: data.context.uri,
          position: data.progress_ms,
          title: data.item.name,
        };
        localStorage.setItem("bookmark_" + data.context.uri, JSON.stringify(bookmark));
        alert("Bookmark gesetzt: " + bookmark.title);
      }
    })
    .catch(console.error);
}

function loadBookmarks() {
  const container = document.getElementById("bookmarks");
  container.innerHTML = "";
  for (const key in localStorage) {
    if (key.startsWith("bookmark_")) {
      const bm = JSON.parse(localStorage.getItem(key));
      const div = document.createElement("div");
      div.textContent = bm.title;
      const playBtn = document.createElement("button");
      playBtn.textContent = "Fortsetzen";
      playBtn.onclick = () => play(bm.uri, bm.position);
      const delBtn = document.createElement("button");
      delBtn.textContent = "🗑️";
      delBtn.onclick = () => {
        localStorage.removeItem(key);
        loadBookmarks();
      };
      div.appendChild(playBtn);
      div.appendChild(delBtn);
      container.appendChild(div);
    }
  }
}
