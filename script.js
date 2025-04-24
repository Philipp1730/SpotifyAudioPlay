import { loginWithSpotify, fetchTokenFromRedirect, getValidAccessToken } from './auth.js';

let accessToken = null;

// Helper functions for secure sessionStorage handling
function encryptToken(token) {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(token);
  return window.crypto.subtle.digest("SHA-256", encoded).then((hashBuffer) => {
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  });
}

async function saveToSessionStorage(key, value) {
  const encryptedValue = await encryptToken(value);
  sessionStorage.setItem(key, encryptedValue);
}

function getFromSessionStorage(key) {
  // For simplicity, this assumes you retrieve the unencrypted value directly for now
  // In real cases, you'd adapt encryption/decryption as needed
  return sessionStorage.getItem(key);
}

function removeFromSessionStorage(key) {
  sessionStorage.removeItem(key);
}

// Initialize the page
window.onload = async () => {
  try {
    const params = new URLSearchParams(window.location.search);

    if (params.has('code')) {
      accessToken = await fetchTokenFromRedirect();
      if (accessToken) {
        history.replaceState(null, '', '/SpotifyAudioPlay/');
        await saveToSessionStorage('spotify_access_token', accessToken);
        showControls();
        startTokenRefreshTimer();
      } else {
        console.warn('❌ Token konnte nach Login nicht geladen werden. Leite erneut weiter.');
        loginWithSpotify();
      }
    } else {
      const access = getFromSessionStorage('spotify_access_token');
      if (access) {
        accessToken = access;
        console.log('✅ Lokale Tokens vorhanden.');
        showControls();
        startTokenRefreshTimer();
      } else {
        console.warn('❌ Keine gültigen Tokens gefunden. Weiterleitung zur Anmeldung.');
        loginWithSpotify();
      }
    }
  } catch (error) {
    console.error('Error during page initialization:', error);
  }
};

// Show controls and hide the login container
function showControls() {
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('controls').style.display = 'block';
}

// Set a bookmark
window.setBookmark = async function () {
  try {
    const playback = await getCurrentPlayback();
    if (!playback) return;

    const { item, progress_ms } = playback;
    const bookmark = {
      track_id: item.id,
      track_name: item.name,
      track_uri: item.uri,
      album_id: item.album.id,
      album_name: item.album.name,
      progress: progress_ms
    };

    deleteBookmarksByAlbumId(bookmark.album_id);
    sessionStorage.setItem(`bookmark-${bookmark.album_id}`, JSON.stringify(bookmark));
    loadBookmarks();
  } catch (error) {
    console.error('Error setting bookmark:', error);
  }
};

// Load bookmarks
window.loadBookmarks = function () {
  const list = document.getElementById('bookmark-list');
  list.innerHTML = '';

  Object.keys(sessionStorage)
    .filter(key => key.startsWith('bookmark-'))
    .forEach(key => {
      const bookmark = JSON.parse(getFromSessionStorage(key));
      const entry = document.createElement('div');
      entry.className = 'bookmark-entry';
      entry.innerHTML = `
        <strong>${bookmark.track_name}</strong> - ${bookmark.album_name}<br>
        <button onclick="resumeBookmark('${bookmark.track_uri}', ${bookmark.progress})">▶️ Fortsetzen</button>
        <button onclick="deleteBookmark('${key}')">🗑️ Löschen</button>
      `;
      list.appendChild(entry);
    });
};

// Resume playback from a bookmark
window.resumeBookmark = async function (track_uri, progress) {
  try {
    const bookmarkKey = Object.keys(sessionStorage).find(
      k => k.startsWith('bookmark-') && JSON.parse(getFromSessionStorage(k)).track_uri === track_uri
    );

    if (!bookmarkKey) {
      console.error('Kein passender Bookmark gefunden');
      return;
    }

    const bookmark = JSON.parse(getFromSessionStorage(bookmarkKey));
    const token = await getValidAccessToken();

    const response = await fetch(`https://api.spotify.com/v1/me/player/play`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
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
  } catch (error) {
    console.error('Error resuming bookmark:', error);
  }
};

// Delete a bookmark
window.deleteBookmark = function (key) {
  try {
    console.log(`Lösche Bookmark mit Key: ${key}`);
    removeFromSessionStorage(key);
    loadBookmarks();
  } catch (error) {
    console.error('Error deleting bookmark:', error);
  }
};

// Pause playback and save a temporary bookmark
window.pausePlayback = async function () {
  try {
    const token = await getValidAccessToken();
    const playback = await getCurrentPlayback();
    if (!playback || !playback.item) return;

    const { item, progress_ms } = playback;
    const bookmark = {
      track_id: item.id,
      track_name: item.name,
      track_uri: item.uri,
      album_id: item.album.id,
      album_name: item.album.name,
      progress: progress_ms
    };

    deleteBookmarksByAlbumId(bookmark.album_id);
    sessionStorage.setItem('bookmark-temp', JSON.stringify(bookmark));

    await fetch(`https://api.spotify.com/v1/me/player/pause`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    loadBookmarks();
  } catch (error) {
    console.error('Error pausing playback:', error);
  }
};

// Resume playback from a temporary bookmark or start playing
window.resumePlayback = async function () {
  try {
    const token = await getValidAccessToken();
    const tempBookmark = JSON.parse(getFromSessionStorage('bookmark-temp'));

    if (tempBookmark) {
      const res = await fetch(`https://api.spotify.com/v1/me/player/play`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          context_uri: `spotify:album:${tempBookmark.album_id}`,
          offset: { uri: tempBookmark.track_uri },
          position_ms: tempBookmark.progress
        })
      });

      if (!res.ok) {
        console.error('Fehler beim Resume aus Bookmark:', await res.json());
      } else {
        removeFromSessionStorage('bookmark-temp');
      }
    } else {
      await fetch(`https://api.spotify.com/v1/me/player/play`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
  } catch (error) {
    console.error('Error resuming playback:', error);
  }
};

// Get the current playback information
window.getCurrentPlayback = async function () {
  try {
    const token = await getValidAccessToken();
    const res = await fetch(`https://api.spotify.com/v1/me/player/currently-playing`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 204 || !res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Error getting current playback:', error);
    return null;
  }
};

// Delete bookmarks by album ID
function deleteBookmarksByAlbumId(albumId) {
  Object.keys(sessionStorage)
    .filter(key => key.startsWith('bookmark-') && JSON.parse(getFromSessionStorage(key)).album_id === albumId)
    .forEach(key => removeFromSessionStorage(key));
}

// Make the login button accessible
window.loginWithSpotify = loginWithSpotify;

// Start the token refresh timer
function startTokenRefreshTimer() {
  setInterval(async () => {
    try {
      const newToken = await getValidAccessToken();
      if (newToken) {
        await saveToSessionStorage('spotify_access_token', newToken);
        console.log('Token automatisch erneuert:', newToken);
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
    }
  }, 50 * 60 * 1000); // 50 minutes
}
