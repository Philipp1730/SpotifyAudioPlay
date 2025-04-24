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

  const { item, progress_ms } = playback;  // 'item' ist der aktuelle Track
  const bookmark = {
    track_id: item.id,  // Speichern der Track-ID
    track_name: item.name,  // Speichern des Track-Namens
    track_uri: item.uri,  // Speichern des Track-URIs
    album_id: item.album.id,  // Speichern der Album-ID
    album_name: item.album.name,  // Speichern des Album-Namens
    progress: progress_ms  // Speichern des Fortschritts
    
  };
  // Lösche alle Bookmarks mit der gleichen album-ID
  Object.keys(localStorage)
    .filter(key => key.startsWith('bookmark-') && JSON.parse(localStorage.getItem(key)).album_id === bookmark.album_id)
    .forEach(key => localStorage.removeItem(key));

  // Speichere das neue Bookmark mit der album-ID als Schlüssel
  localStorage.setItem(`bookmark-${bookmark.album_id}`, JSON.stringify(bookmark));
  loadBookmarks();  // Lade alle Bookmarks neu
}

// Bookmarks laden
/*window.loadBookmarks = function () {
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
*/
window.loadBookmarks = function () {
  const list = document.getElementById('bookmark-list');
  list.innerHTML = '';  // Leere die Liste

  // Gehe durch alle gespeicherten Bookmarks
  Object.keys(localStorage)
    .filter(k => k.startsWith('bookmark-'))
    .forEach(key => {
      const bookmark = JSON.parse(localStorage.getItem(key));
      const entry = document.createElement('div');
      entry.className = 'bookmark-entry';
      entry.innerHTML = `
        <strong>${bookmark.track_name}</strong> - ${bookmark.album_name}<br>
        <button onclick="resumeBookmark('${bookmark.track_uri}', ${bookmark.progress})">▶️ Fortsetzen</button>
        <button onclick="deleteBookmark('${bookmark.track_id}')">🗑️ Löschen</button>
      `;
      list.appendChild(entry);
    });
}
// Bookmark fortsetzen
window.resumeBookmark = async function (uri, progress) {

  const response = await fetch(`https://api.spotify.com/v1/me/player/play`, {
    method: 'PUT',
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      uris: [uri],  // Liste der URI des Tracks (nicht des Albums)
      position_ms: progress
    })
  });
}


// Bookmark löschen
window.deleteBookmark = function (key) {
  console.log('Alle Bookmark-Keys:');
  Object.keys(localStorage).filter(k => k.startsWith('bookmark-')).forEach(k => console.log(k));
  console.log(`Lösche Bookmark mit Key: ${key}`);
  localStorage.removeItem(key);
  console.log(`Neu laden`);
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
