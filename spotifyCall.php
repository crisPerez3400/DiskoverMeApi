<?php
function getSpotifyAccessToken($clientId, $clientSecret) {
    $auth = base64_encode("$clientId:$clientSecret");

    $options = [
        'http' => [
            'header'  => "Authorization: Basic $auth\r\n" .
                         "Content-Type: application/x-www-form-urlencoded\r\n",
            'method'  => 'POST',
            'content' => http_build_query(['grant_type' => 'client_credentials']),
        ],
    ];

    $context = stream_context_create($options);
    $result = file_get_contents('https://accounts.spotify.com/api/token', false, $context);
    $data = json_decode($result, true);

    return $data['access_token'];
}

function searchSpotifyTracks($token, $query, $offset = 0) {
    $url = "https://api.spotify.com/v1/search?" . http_build_query([
        'q' => $query,
        'type' => 'track',
        'limit' => 10,
        'offset' => $offset
    ]);

    $options = [
        'http' => [
            'header' => "Authorization: Bearer $token\r\n",
            'method' => 'GET',
        ],
    ];

    $context = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    return json_decode($result, true);
}

function getArtistGenres($token, $artistId) {
    $url = "https://api.spotify.com/v1/artists/$artistId";

    $options = [
        'http' => [
            'header' => "Authorization: Bearer $token\r\n",
            'method' => 'GET',
        ],
    ];

    $context = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    $data = json_decode($result, true);

    return $data['genres'] ?? [];
}

$clientId = '2c80dd68d2fd42a2a95718c601c83aca';
$clientSecret = '8ad34082f9764144ab32448ace2729dc';

$token = getSpotifyAccessToken($clientId, $clientSecret);

// Generar búsqueda aleatoria
$length = rand(1, 3);
$characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
$query = '';
for ($i = 0; $i < $length; $i++) {
    $query .= $characters[rand(0, strlen($characters) - 1)];
}
$offset = rand(0, 1000);

$data = searchSpotifyTracks($token, $query, $offset);

$response = [];

if (isset($data['tracks']['items'])) {
    foreach ($data['tracks']['items'] as $track) {
        $trackId = $track['id'];
        $trackName = $track['name'];
        $artistId = $track['artists'][0]['id'];
        $artistName = $track['artists'][0]['name'];
        $previewUrl = $track['preview_url'] ?? null;
        $releaseDate = $track['album']['release_date'] ?? 'Desconocido';
        $genres = getArtistGenres($token, $artistId);
        $genreText = !empty($genres) ? implode(', ', $genres) : 'Desconocido';
        $albumImage = isset($track['album']['images'][0]['url']) ? $track['album']['images'][0]['url'] : null;

        $response[] = [
            'track_id' => $trackId,
            'track_name' => $trackName,
            'artist_id' => $artistId,
            'artist_name' => $artistName,
            'preview_url' => $previewUrl,
            'release_date' => $releaseDate,
            'genres' => $genreText,
            'album_image' => $albumImage, // URL de la portada
        ];
    }
} else {
    $response['error'] = 'No se encontraron resultados.';
}

// Devolver respuesta como JSON
header('Content-Type: application/json');
echo json_encode($response);
?>
