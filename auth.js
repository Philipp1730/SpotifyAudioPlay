const clientId = 'a727fe020d254b26a32d982d998d0126'; // <<< Deine echte Client ID hier einfügen
const redirectUri = 'https://philipp1730.github.io/SpotifyAudioPlay/';
const scope = 'user-read-playback-state user-modify-playback-state user-read-currently-playing user-library-read app-remote-control';
//const SCOPES = 'user-library-read app-remote-control';
function generateCodeVerifier(length = 128) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function loginWithSpotify() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  localStorage.setItem('code_verifier', codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scope,
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
  window.location.href = authUrl;
}

export async function fetchTokenFromRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const codeVerifier = localStorage.getItem('code_verifier');

  if (!code || !codeVerifier) {
    console.error('Kein Code oder Code Verifier gefunden');
    return null;
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const data = await response.json();

  if (data.access_token) {
    localStorage.setItem('spotify_access_token', data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('spotify_refresh_token', data.refresh_token);
      console.log('Refresh Token erhalten:', data.refresh_token);
    } else {
      console.warn('⚠️ Kein Refresh Token von Spotify erhalten. Token kann später nicht erneuert werden.');
    }
    console.log('Token erhalten:', data.access_token);
    return data.access_token;
  } else {
    console.error('Fehler beim Token-Abruf:', data);
    return null;
  }
}
  export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  if (!refreshToken) {
    console.error('Kein Refresh Token gefunden.');
    return null;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const data = await response.json();

  if (data.access_token) {
    localStorage.setItem('spotify_access_token', data.access_token);
    console.log('Neuer Access Token erhalten:', data.access_token);
    return data.access_token;
  } else {
    console.error('Fehler beim Token-Refresh:', data);
    return null;
  }
}
  
  export async function getValidAccessToken() {
  let token = localStorage.getItem('spotify_access_token');

  // Probiere einen Test-API-Aufruf
  const testResponse = await fetch('https://api.spotify.com/v1/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (testResponse.status === 401) {
    console.warn('Access Token abgelaufen. Versuche zu erneuern…');
    token = await refreshAccessToken();
  }

  return token;
}

/*export function checkAuthTokens() {
  const access = localStorage.getItem('spotify_access_token');
  const refresh = localStorage.getItem('spotify_refresh_token');

  if (!access || !refresh) {
    console.warn('❌ Kein gültiger Access- oder Refresh-Token vorhanden. Weiterleitung zur Anmeldung.');
    loginWithSpotify(); // Löst neuen Login aus
  } else {
    console.log('✅ Tokens vorhanden. Zugriff möglich.');
  }
}*/

