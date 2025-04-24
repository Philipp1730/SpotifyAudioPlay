import { loginWithSpotify, fetchTokenFromRedirect, getValidAccessToken } from './auth.js';
import CryptoJS from 'crypto-js'; // For token encryption

let accessToken = null;

// Helper functions for token encryption and storage
function encryptToken(token) {
  const secretKey = 'your-secret-key'; // Store securely!
  return CryptoJS.AES.encrypt(token, secretKey).toString();
}

function decryptToken(encryptedToken) {
  const secretKey = 'your-secret-key';
  const bytes = CryptoJS.AES.decrypt(encryptedToken, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

function saveEncryptedToken(key, value) {
  const encryptedValue = encryptToken(value);
  sessionStorage.setItem(key, encryptedValue); // Use sessionStorage for short-term storage
}

function getDecryptedToken(key) {
  const encryptedValue = sessionStorage.getItem(key);
  return encryptedValue ? decryptToken(encryptedValue) : null;
}

function removeToken(key) {
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
        saveEncryptedToken('spotify_access_token', accessToken);
        showControls();
        startTokenRefreshTimer();
      } else {
        console.warn('❌ Token konnte nach Login nicht geladen werden. Leite erneut weiter.');
        loginWithSpotify();
      }
    } else {
      const encryptedAccessToken = sessionStorage.getItem('spotify_access_token');

      if (encryptedAccessToken) {
        accessToken = getDecryptedToken('spotify_access_token');
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

// Secure API request helper
async function secureApiRequest(url, options = {}) {
  try {
    const token = getDecryptedToken('spotify_access_token');
    if (!token) {
      throw new Error('No valid access token found');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      console.warn('Access token expired. Attempting to refresh...');
      const newToken = await getValidAccessToken();
      if (newToken) {
        saveEncryptedToken('spotify_access_token', newToken);
        return secureApiRequest(url, options); // Retry with refreshed token
      } else {
        throw new Error('Failed to refresh token');
      }
    }

    return response;
  } catch (error) {
    console.error('Error in API request:', error);
  }
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
      progress: progress_ms,
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
      const bookmark = JSON.parse(sessionStorage.getItem(key));
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
      k => k.startsWith('bookmark-') && JSON.parse(sessionStorage.getItem(k)).track_uri === track_uri
    );

    if (!bookmarkKey) {
      console.error('Kein passender Bookmark gefunden');
      return;
    }

    const bookmark = JSON.parse(sessionStorage.getItem(bookmarkKey));
    const response = await secureApiRequest(`https://api.spotify.com/v1/me/player/play`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context_uri: `spotify:album:${bookmark.album_id}`,
        offset: { uri: bookmark.track_uri },
        position_ms: bookmark.progress,
      }),
    });

    if (!response.ok) {
      console.error('Fehler beim Fortsetzen:', await response.json());
    }
  } catch (error) {
    console.error('Error resuming bookmark:', error);
  }
};

// Delete bookmarks by album ID
function deleteBookmarksByAlbumId(albumId) {
  Object.keys(sessionStorage)
    .filter(key => key.startsWith('bookmark-') && JSON.parse(sessionStorage.getItem(key)).album_id === albumId)
    .forEach(key => sessionStorage.removeItem(key));
}

// Start the token refresh timer
function startTokenRefreshTimer() {
  setInterval(async () => {
    try {
      const newToken = await getValidAccessToken();
      if (newToken) {
        saveEncryptedToken('spotify_access_token', newToken);
        console.log('Token automatisch erneuert:', newToken);
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
    }
  }, 50 * 60 * 1000); // 50 minutes
}
