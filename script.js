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
  const token = localStorage.getItem('spotify_access_token');
  if (!token) {
    console.error('Kein Spotify-Token gefunden');
    return;
  }

  // Hole den aktuellen Track und die Wiedergabeposition
  fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })
  .then(response => response.json())
  .then(data => {
    if (data && data.item) {
      const trackId = data.item.id;
      const trackName = data.item.name;
      const trackPosition = data.progress_ms; // Aktuelle Wiedergabeposition in Millisekunden

      // Überprüfen, ob ein Bookmark für dieses Hörbuch existiert
      let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];

      // Entferne alte Bookmarks für das gleiche Hörbuch
      bookmarks = bookmarks.filter(bookmark => bookmark.trackId !== trackId);

      // Füge das neue Bookmark hinzu
      bookmarks.push({
        trackId,
        trackName,
        trackPosition
      });

      // Speichern der Bookmarks
      localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
      console.log(`Bookmark für ${trackName} bei ${trackPosition} ms gesetzt`);
    } else {
      console.error('Kein Track gerade gespielt');
    }
  })
  .catch(error => console.error('Fehler:', error));
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

// Pause
window.pausePlayback = async function () {
  await fetch(`https://api.spotify.com/v1/me/player/pause`, {
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
