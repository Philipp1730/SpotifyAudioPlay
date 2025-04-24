// auth.js

const clientId = 'a727fe020d254b26a32d982d998d0126'; // Ersetze mit deiner Spotify Client ID
const redirectUri = 'https://philipp1730.github.io/SpotifyAudioPlay/';
const scopes = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  'user-read-email',
  'user-read-private'
];

function generateCodeVerifier(length = 128) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
}

async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function loginWithSpotify() {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  localStorage.setItem('code_verifier', verifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes.join(' '),
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge
  });

  window.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function fetchTokenFromRedirect() {
  const code = new URLSearchParams(window.location.search).get('code');
  if (!code) return null;

  const verifier = localStorage.getItem('code_verifier');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier
    })
  });

  const data = await response.json();
  const token = data.access_token;
  if (token) localStorage.setItem('spotify_access_token', token);
  return token;
}
