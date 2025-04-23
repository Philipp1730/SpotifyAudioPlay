const clientId = "YOUR_CLIENT_ID";
const redirectUri = "https://philipp1730.github.io/SpotifyAudioPlay/";
const scope = "user-read-playback-state user-modify-playback-state";
let accessToken = null;

async function generateCodeVerifier() {
  const array = new Uint8Array(64);
  window.crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function login() {
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem("code_verifier", verifier);
  const args = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: scope
  });
  window.location = `https://accounts.spotify.com/authorize?${args}`;
}

async function fetchAccessToken(code) {
  const verifier = localStorage.getItem("code_verifier");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier
    })
  });
  const data = await response.json();
  accessToken = data.access_token;
  localStorage.setItem("access_token", accessToken);
}

function play(uri, positionMs) {
  fetch("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      context_uri: uri,
      position_ms: positionMs
    })
  });
}

function pause() {
  fetch("https://api.spotify.com/v1/me/player/pause", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
}

document.getElementById("login-button").addEventListener("click", login);
document.getElementById("pause-button").addEventListener("click", pause);
