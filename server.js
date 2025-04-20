// Importar dependencias
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const spotifyPreviewFinder = require('spotify-preview-finder');

// Configurar Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Función para obtener el token de acceso de Spotify
async function getSpotifyAccessToken(clientId, clientSecret) {
  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      params: {
        grant_type: 'client_credentials'
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Error obteniendo token de Spotify:', error.message);
    throw new Error('Error al obtener token de acceso');
  }
}

// Función para obtener géneros disponibles
async function getAvailableGenres(token) {
  try {
    const response = await axios({
      method: 'get',
      url: 'https://api.spotify.com/v1/recommendations/available-genre-seeds',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data.genres;
  } catch (error) {
    console.error('Error obteniendo géneros disponibles:', error.message);
    throw new Error('Error al obtener géneros disponibles');
  }
}

// Función para buscar artistas por género
async function searchArtistsByGenre(token, genre, limit = 1) {
  try {
    // Buscar artistas relacionados con el género
    const response = await axios({
      method: 'get',
      url: 'https://api.spotify.com/v1/search',
      params: {
        q: `genre:"${genre}"`,
        type: 'artist',
        limit: limit,
        offset: Math.floor(Math.random() * 50) // Offset aleatorio para variedad
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Si no hay resultados con búsqueda exacta, intentar con búsqueda general
    if (response.data.artists.items.length === 0) {
      const fallbackResponse = await axios({
        method: 'get',
        url: 'https://api.spotify.com/v1/search',
        params: {
          q: genre,
          type: 'artist',
          limit: limit,
          offset: Math.floor(Math.random() * 50)
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return fallbackResponse.data.artists.items;
    }

    return response.data.artists.items;
  } catch (error) {
    console.error('Error en búsqueda de artistas por género:', error.response?.data || error.message);
    throw new Error(`Error al buscar artistas del género ${genre}`);
  }
}

// Función para buscar artistas aleatorios (sin filtro de género)
async function searchRandomArtists(token) {
  try {
    // Generar letra aleatoria para búsqueda
    const randomChar = String.fromCharCode(97 + Math.floor(Math.random() * 26));
    const offset = Math.floor(Math.random() * 1000); // Offset aleatorio para variedad

    const response = await axios({
      method: 'get',
      url: 'https://api.spotify.com/v1/search',
      params: {
        q: randomChar,
        type: 'artist',
        limit: 1, // Obtenemos 1 artista aleatorio
        offset: offset
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return response.data.artists.items[0]; // Devuelve el primer artista encontrado
  } catch (error) {
    console.error('Error en búsqueda de artistas:', error.response?.data || error.message);
    throw new Error('Error al buscar artistas');
  }
}

// Función para obtener las top tracks de un artista
async function getArtistTopTracks(token, artistId) {
  try {
    const response = await axios({
      method: 'get',
      url: `https://api.spotify.com/v1/artists/${artistId}/top-tracks`,
      params: {
        market: 'US' // Puedes cambiar el mercado según necesites
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data.tracks.slice(0, 5); // Las 5 canciones más populares
  } catch (error) {
    console.error('Error obteniendo top tracks:', error.message);
    throw new Error('Error al obtener canciones populares');
  }
}

// Función para obtener previews (se mantiene igual)
async function getPreviewUrls(query) {
  try {
    const previews = await spotifyPreviewFinder(query);
    return previews || [];
  } catch (error) {
    console.error(`Error obteniendo previews para "${query}":`, error.message);
    return [];
  }
}

// Ruta para obtener todos los géneros disponibles
app.get('/api/genres', async (req, res) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Faltan credenciales de Spotify' });
  }
  
  try {
    const token = await getSpotifyAccessToken(clientId, clientSecret);
    const genres = await getAvailableGenres(token);
    
    res.json({
      success: true,
      genres: genres
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Ruta principal modificada para aceptar filtro por género
app.get('/api/artists-top-tracks', async (req, res) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const genre = req.query.genre; // Obtener el género del query parameter
  
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Faltan credenciales de Spotify' });
  }
  
  try {
    const token = await getSpotifyAccessToken(clientId, clientSecret);
    
    let artist;
    
    // 1. Obtener artista según filtro de género o aleatorio
    if (genre) {
      const artists = await searchArtistsByGenre(token, genre);
      if (artists.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: `No se encontraron artistas del género ${genre}` 
        });
      }
      artist = artists[0]; // Tomar el primer artista encontrado
    } else {
      artist = await searchRandomArtists(token);
      if (!artist) {
        return res.status(404).json({ success: false, message: 'No se encontraron artistas' });
      }
    }

    // 2. Obtener top tracks del artista
    const topTracks = await getArtistTopTracks(token, artist.id);
    
    // 3. Procesar las canciones
    const tracksWithPreviews = await Promise.all(
      topTracks.map(async (track) => {
        const previewData = await getPreviewUrls(track.name);
        
        return {
          track_id: track.id,
          track_name: track.name,
          preview_urls: previewData,
          duration_ms: track.duration_ms,
          popularity: track.popularity,
          album_image: track.album.images[0]?.url || null
        };
      })
    );

    // 4. Preparar respuesta
    const response = {
      success: true,
      artist: {
        id: artist.id,
        name: artist.name,
        genres: artist.genres,
        popularity: artist.popularity,
        image: artist.images[0]?.url || null
      },
      top_tracks: tracksWithPreviews,
      filtered_by_genre: genre ? true : false,
      genre: genre || null
    };

    res.json(response);
    
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Servidor de Spotify funcionando!');
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});