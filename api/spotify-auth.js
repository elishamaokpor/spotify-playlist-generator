export default function handler(req, res) {
  const scope = 'playlist-modify-public playlist-modify-private';
  const redirectUri = 'https://whatsthesoundtrack.vercel.app';
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope,
    redirect_uri: redirectUri,
    state: req.query.playlist || ''
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
}