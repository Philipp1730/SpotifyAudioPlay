// script.js
import { loginWithSpotify, fetchTokenFromRedirect } from './auth.js';

let accessToken = null;

window.addEventListener('DOMContentLoaded', async () => {
  accessToken = localStorage.getItem('spotify_access_token');
  if (!accessToken) {
    accessToken = await fetchTokenFromRedirect();
  }

  if (accessToken) {
    document.getElementById('login-button').style.display = 'none';
    document.getElementById('controls').style.display = 'block';
  }
});

window.loginWithSpotify = loginWithSpotify;

window.setBookmark = async () => {
  const playback = await getCurrentPlayback();
  if (playback) {
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '{}');
    bookmarks[playback.context?.uri || playback.item.album.uri] = {
      position: playback.progress_ms,
      uri: playback.context?.uri || playback.item.album.uri,
      name: playback.item.album.name
    };
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    alert('Bookmark gespeichert!');
  }
};

window.loadBookmarks = () => {
  const container = document.getElementById('bookmark-list');
  container.innerHTML = '';
  const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '{}');
  for (const [uri, data] of Object.entries(bookmarks)) {
    const item = document.createElement('div');
    item.className = 'bookmark-item';
    item.innerHTML = `
      <strong>${data.name}</strong>
      <button onclick="playFromBookmark('${data.uri}', ${data.position})">▶️</button>
      <button onclick="deleteBookmark('${uri}')">🗑️</button>
    `;
    container.appendChild(item);
  }
};

window.deleteBookmark = (uri) => {
  const bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '{}');
  delete bookmarks[uri];
  localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
  window.loadBookmarks();
};

window.playFromBookmark = async (uri, position) => {
  await fetch('https://api.spotify.com/v1/me/player/play', {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + accessToken },
    body: JSON.stringify({ context_uri: uri, position_ms: position })
  });
};

window.pausePlayback = async () => {
  await fetch('https://api.spotify.com/v1/me/player/pause', {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + accessToken }
  });
};

async function getCurrentPlayback() {
  const res = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  });
  if (res.ok) return await res.json();
  else alert('Fehler beim Abrufen der Wiedergabe.');
}
