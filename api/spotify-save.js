export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { code, tracks, playlistName, description } = req.body;
  const redirectUri = 'https://whatsthesoundtrack.vercel.app/';

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
        ).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error('Failed to get access token');
    const accessToken = tokenData.access_token;

    // 2. Get user ID
    const userRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const userData = await userRes.json();
    const userId = userData.id;

    // 3. Create playlist
    const createRes = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: playlistName,
        description: description,
        public: false
      })
    });
    const playlistData = await createRes.json();
    const playlistId = playlistData.id;
    const playlistUrl = playlistData.external_urls.spotify;

    // 4. Search for each track and get URI
    const trackUris = [];
    for (const track of tracks) {
      const searchRes = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(track.title + ' ' + track.artist)}&type=track&limit=1`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const searchData = await searchRes.json();
      const uri = searchData.tracks?.items?.[0]?.uri;
      if (uri) trackUris.push(uri);
    }

    // 5. Add tracks to playlist
    await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: trackUris })
    });

    res.status(200).json({ playlistUrl });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}