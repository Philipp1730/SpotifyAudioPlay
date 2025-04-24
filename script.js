import { loginWithSpotify, fetchTokenFromRedirect } from './auth.js';

let accessToken = null;

// Seite initialisieren
window.onload = async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has('code')) {
    accessToken = await fetchTokenFromRedirect();
    history.replaceState(null, '', '/SpotifyAudioPlay/');
    showControls();
  } else if (localStorage.getItem('spotify_access_token')) {
    accessToken = localStorage.getItem('spotify_access_token');
    showControls();
  }
};

// Steuerung anzeigen
function showControls() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('controls').style.display = 'block';
}

// Bookmark setzen
window.setBookmark = async function () {
  const playback = await getCurrentPlayback();
  if (!playback) return;

  const { item, progress_ms } = playback;
  const bookmark = {
    id: item.album.id,
    name: item.album.name,
    uri: item.album.uri,
    progress: progress_ms
  };

  // Entferne das alte Bookmark, wenn ein neues für das gleiche Album gesetzt wird
  if (localStorage.getItem(`bookmark-${bookmark.id}`)) {
    localStorage.removeItem(`bookmark-${bookmark.id}`);
  }

  localStorage.setItem(`bookmark-${bookmark.id}`, JSON.stringify(bookmark));
  loadBookmarks();
}

// Bookmarks laden
window.loadBookmarks = function () {
  const list = document.getElementById('bookmark-list');
  list.innerHTML = '';

  Object.keys(localStorage)
    .filter(k => k.startsWith('bookmark-'))
    .forEach(key => {
      const bookmark = JSON.parse(localStorage.getItem(key));
      const entry = document.createElement('div');
      entry.className = 'bookmark-entry';
      entry.innerHTML = `
        <strong>${bookmark.name}</strong><br>
        <button onclick="resumeBookmark('${bookmark.uri}', ${bookmark.progress})">▶️ Fortsetzen</button>
        <button onclick="deleteBookmark('${bookmark.id}')">🗑️ Löschen</button>
      `;
      list.appendChild(entry);
    });
}

// Bookmark fortsetzen
window.resumeBookmark = async function (uri, progress) {
  await fetch(`https://api.spotify.com/v1/me/player/play`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: JSON.stringify({
      context_uri: uri,
      position_ms: progress
    })
  });
}

// Bookmark löschen
window.deleteBookmark = function (id) {
  localStorage.removeItem(`bookmark-${id}`);
  loadBookmarks();
}

// Pause und Fortsetzen der Wiedergabe
window.togglePause = async function () {
  const playback = await getCurrentPlayback();

  if (playback && playback.is_playing) {
    await pausePlayback();
  } else {
    await resumePlayback();
  }
}

// Pause
async function pausePlayback() {
  await fetch(`https://api.spotify.com/v1/me/player/pause`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
}

// Wiedergabe fortsetzen
async function resumePlayback() {
  await fetch(`https://api.spotify.com/v1/me/player/play`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
}

// Aktuelle Wiedergabe holen
async function getCurrentPlayback() {
  const res = await fetch(`https://api.spotify.com/v1/me/player/currently-playing`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (res.status === 204 || !res.ok) return null;
  return await res.json();
}

// Login-Button zugänglich machen
window.loginWithSpotify = loginWithSpotify;
