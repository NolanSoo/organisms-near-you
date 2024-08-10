let map;
let correctLocation;
let userLocationMarker;
let gameInProgress = false;
let currentRound = 0;
let roundScores = [];
let sessionScore = 0;
let sessionBest = 0;
let personalBest = parseInt(localStorage.getItem('personalBest')) || 0;

const searchRadiusMiles = 50;
const searchRadiusKm = searchRadiusMiles * 1.60934;

const latitudeRangeGlobal = [-50, 60]; // Latitude range (50°S to 60°N)
const longitudeRangeGlobal = [-180, 180]; // Full longitude range

const latitudeRangeEurope = [37, 63]; // Latitude range for Europe
const longitudeRangeEurope = [-10, 32]; // Longitude range for Europe

document.getElementById('startGame').addEventListener('click', () => startGame('global'));
document.getElementById('startEuropeGame').addEventListener('click', () => startGame('europe'));

function initializeMap() {
  console.log("Initializing map...");
  map = L.map('mapContainer').setView([0, 0], 2); // Start zoomed out to the max level

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.on('click', handleMapClick);
  console.log("Map initialized.");
}

function startGame(mode) {
  if (gameInProgress) {
    console.log("Game already in progress.");
    return;
  }

  console.log("Starting new game...");
  gameInProgress = true;
  currentRound = 0;
  roundScores = [];
  sessionScore = 0;
  updateScoreDisplay();

  // Set the latitude and longitude ranges based on the selected mode
  let latRange, lonRange;
  if (mode === 'europe') {
    latRange = latitudeRangeEurope;
    lonRange = longitudeRangeEurope;
  } else {
    latRange = latitudeRangeGlobal;
    lonRange = longitudeRangeGlobal;
  }

  startNewRound(latRange, lonRange);
}

function startNewRound(latRange, lonRange) {
  if (currentRound >= 4) {
    console.log("Ending game after 4 rounds.");
    endGame();
    return;
  }

  console.log(`Starting round ${currentRound + 1}`);
  currentRound++;
  toggleLoadingScreen(true); // Show loading screen while searching for a location
  findLocationWithPicture(latRange, lonRange);
}

function findLocationWithPicture(latRange, lonRange) {
  const baseLat = getRandomLatitude(latRange);
  const baseLon = getRandomLongitude(lonRange);

  console.log(`Searching for location with coordinates around: ${baseLat}, ${baseLon}`);

  const latMin = baseLat - 0.05;
  const latMax = baseLat + 0.05;
  const lonMin = baseLon - 0.05;
  const lonMax = baseLon + 0.05;

  console.log(`Latitude range: ${latMin} to ${latMax}`);
  console.log(`Longitude range: ${lonMin} to ${lonMax}`);

  if (userLocationMarker) {
    map.removeLayer(userLocationMarker);
  }

  const url = `https://api.gbif.org/v1/occurrence/search?decimalLatitude=${latMin},${latMax}&decimalLongitude=${lonMin},${lonMax}&distance=${searchRadiusKm}&limit=1`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      console.log("Fetch response data:", data);
      const validResults = data.results.filter(result => result.media && result.media.length > 0);
      if (validResults.length > 0) {
        console.log("Found valid result with media.");
        correctLocation = {
          lat: validResults[0].decimalLatitude,
          lon: validResults[0].decimalLongitude,
          media: validResults[0].media[0].identifier
        };
        toggleLoadingScreen(false); // Hide loading screen when image is ready
        displayImage(correctLocation.media);
      } else {
        console.log("No valid results found. Retrying...");
        setTimeout(() => findLocationWithPicture(latRange, lonRange), 0); // Retry immediately
      }
    })
    .catch(error => console.error("Error fetching data:", error));
}

function displayImage(imageUrl) {
  console.log("Displaying image:", imageUrl);
  const imageContainer = document.getElementById('imageContainer');
  imageContainer.innerHTML = `<img src="${imageUrl}" alt="Location Image" style="width: 100%; height: auto;">`;
  imageContainer.style.display = 'block';
}

function handleMapClick(e) {
  if (!gameInProgress || !correctLocation) {
    console.log("Game not in progress or no correct location.");
    return;
  }

  const userLatLng = e.latlng;
  const correctLatLng = L.latLng(correctLocation.lat, correctLocation.lon);
  const distance = userLatLng.distanceTo(correctLatLng) / 1000; // Convert to kilometers

  const score = calculateScore(distance);
  roundScores.push(score);
  sessionScore += score;

  console.log(`User clicked at ${userLatLng}. Distance from correct location: ${Math.round(distance)} km. Score: ${Math.round(score)}`);

  if (userLocationMarker) {
    map.removeLayer(userLocationMarker);
  }

  userLocationMarker = L.marker(userLatLng, { color: 'blue' }).addTo(map);

  L.popup()
    .setLatLng(userLatLng)
    .setContent(`You were ${Math.round(distance)} km away. Score: ${Math.round(score)}`)
    .openOn(map);

  // Show correct location only when user clicks
  L.popup()
    .setLatLng([correctLocation.lat, correctLocation.lon])
    .setContent(`Correct location: ${correctLocation.lat.toFixed(2)}, ${correctLocation.lon.toFixed(2)}`)
    .openOn(map);

  updateScoreDisplay();

  if (currentRound >= 4) {
    endGame();
  } else {
    document.getElementById('nextButton').style.display = 'block'; // Show "Next" button after each round
  }
}

function calculateScore(distance) {
  if (distance > 4000) return 0;
  return Math.round(5000 - (distance * 1.25));
}

function updateScoreDisplay() {
  console.log(`Updating score display. Session Score: ${Math.round(sessionScore)}, Session Best: ${Math.round(sessionBest)}, Personal Best: ${Math.round(personalBest)}`);
  document.getElementById('scoreDisplay').textContent = `Session Score: ${Math.round(sessionScore)}, Session Best: ${Math.round(sessionBest)}, Personal Best: ${Math.round(personalBest)}`;
}

function endGame() {
  console.log("Ending game.");
  gameInProgress = false;
  const totalRoundScore = roundScores.reduce((acc, score) => acc + score, 0);
  if (totalRoundScore > sessionBest) {
    sessionBest = totalRoundScore;
  }
  if (sessionScore > personalBest) {
    personalBest = sessionScore;
    localStorage.setItem('personalBest', personalBest);
  }
  updateScoreDisplay();
  alert(`Game Over! Your session score: ${Math.round(sessionScore)}. Click "Start New Game" to play again.`);
}

function getRandomLatitude(latRange) {
  return Math.random() * (latRange[1] - latRange[0]) + latRange[0]; // Random latitude within specified range
}

function getRandomLongitude(lonRange) {
  return Math.random() * (lonRange[1] - lonRange[0]) + lonRange[0]; // Random longitude within specified range
}

function toggleLoadingScreen(show) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = show ? 'flex' : 'none';
    } else {
        console.error("Loading screen element not found.");
    }
}

// Event listener for the "Next" button
document.getElementById('nextButton').addEventListener('click', function() {
    document.getElementById('nextButton').style.display = 'none'; // Hide the button
    startNewRound(); // Start the next round
});

initializeMap();
