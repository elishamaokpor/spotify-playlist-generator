export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { code, tracks, playlistName, description } = req.body;
  const redirectUri = 'https://whatsthesoundtrack.vercel.app/';

  try {
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
    if (!tokenData.access_token) {
      return res.status(500).json({ error: 'token_failed', detail: tokenData });
    }
    const accessToken = tokenData.access_token;

    const userRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const userData = await userRes.json();

    const createRes = await fetch(`https://api.spotify.com/v1/users/${userData.id}/playlists`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playlistName, description, public: false })
    });
    const playlistData = await createRes.json();

    const trackUris = (await Promise.all(
      tracks.map(async (track) => {
        try {
          const s = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(track.title + ' ' + track.artist)}&type=track&limit=1`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          const sd = await s.json();
          return sd.tracks?.items?.[0]?.uri || null;
        } catch { return null; }
      })
    )).filter(Boolean);

    await fetch(`https://api.spotify.com/v1/playlists/${playlistData.id}/tracks`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: trackUris })
    });

    if (!playlistData.id) throw new Error('playlist_create_failed: ' + JSON.stringify(playlistData));
res.status(200).json({ playlistUrl: playlistData.external_urls.spotify });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}