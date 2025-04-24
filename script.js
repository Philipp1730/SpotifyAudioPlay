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
        <button onclick="deleteBookmark('${key}')">🗑️ Löschen</button>
      `;
      list.appendChild(entry);
    });
}
// Bookmark fortsetzen
/*window.resumeBookmark = async function (uri, progress) {

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
}*/
window.resumeBookmark = async function (track_uri, progress) {
  // Nur über Bookmark-Keys iterieren
  const bookmarkKey = Object.keys(localStorage)
    .find(k => k.startsWith('bookmark-') && JSON.parse(localStorage.getItem(k)).track_uri === track_uri);

  if (!bookmarkKey) {
    console.error("Kein passender Bookmark gefunden");
    return;
  }

  const bookmark = JSON.parse(localStorage.getItem(bookmarkKey));

  const response = await fetch(`https://api.spotify.com/v1/me/player/play`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      context_uri: `spotify:album:${bookmark.album_id}`,
      offset: {
        uri: bookmark.track_uri
      },
      position_ms: bookmark.progress
    })
  });

  if (!response.ok) {
    console.error('Fehler beim Fortsetzen:', await response.json());
  }
};


// Bookmark löschen
window.deleteBookmark = function (key) {
  console.log(`Lösche Bookmark mit Key: ${key}`);
  localStorage.removeItem(key);
  loadBookmarks();
}
// Pause
window.pausePlayback = async function () {
  const playback = await getCurrentPlayback();
  if (!playback || !playback.item) return;

  const { item, progress_ms } = playback;
  const bookmark = {
    track_id: item.id,
    track_name: item.name,   // Jetzt den Track-Namen speichern
    track_uri: item.uri,
    album_id: item.album.id,
    album_name: item.album.name,  // Album-Name hinzufügen
    progress: progress_ms
  };

  localStorage.setItem('bookmark-temp', JSON.stringify(bookmark));

  await fetch(`https://api.spotify.com/v1/me/player/pause`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
 loadBookmarks();
}



// Wiedergabe fortsetzen
window.resumePlayback = async function () {
  const tempBookmark = localStorage.getItem('bookmark-temp');
  if (tempBookmark) {
   
  const bookmark = JSON.parse(tempBookmark);
  
    
    const res = await fetch(`https://api.spotify.com/v1/me/player/play`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        context_uri: `spotify:album:${bookmark.album_id}`,
        offset: { uri: bookmark.track_uri },
        position_ms: bookmark.progress
      })
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Fehler beim Resume aus Bookmark:', err);
    } else {
      localStorage.removeItem('bookmark-temp');
    }

  } else {
    // Wenn kein temp-Bookmark existiert, einfach standard play
    await fetch(`https://api.spotify.com/v1/me/player/play`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
  }
}



// Aktuelle Wiedergabe holen
window.getCurrentPlayback=async function () {
  const res = await fetch(`https://api.spotify.com/v1/me/player/currently-playing`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (res.status === 204 || !res.ok) return null;
  return await res.json();
}

// Login-Button zugänglich machen
window.loginWithSpotify = loginWithSpotify;
