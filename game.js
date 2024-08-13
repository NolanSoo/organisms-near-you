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

document.getElementById('startGame').addEventListener('click', startGame);

function initializeMap() {
  console.log("Initializing map...");
  map = L.map('mapContainer').setView([0, 0], 2); // Start zoomed out to the max level

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.on('click', handleMapClick);
  console.log("Map initialized.");
}

function startGame() {
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

  // Hide loading screen and show game container
  toggleLoadingScreen(false);
  document.getElementById('imageContainer').style.display = 'block';

  startNewRound();
}

function startNewRound() {
  if (currentRound >= 4) {
    console.log("Ending game after 4 rounds.");
    endGame();
    return;
  }

  console.log(`Starting round ${currentRound + 1}`);
  currentRound++;
  toggleLoadingScreen(true); // Show loading screen while searching for a location
  findLocationWithPicture();
}

function findLocationWithPicture() {
  const isEuropeMode = document.getElementById('europe').checked;
  const isAsiaMode = document.getElementById('asia').checked;
  const isUSAMode = document.getElementById('usa').checked;

  let latitudeRange, longRange;

  if (isAsiaMode) {
    latitudeRange = [11, 59];
    longRange = [43, 120];
  } else if (isUSAMode) {
    latitudeRange = [26, 49];
    longRange = [-124, -68];
  } else if (isEuropeMode) {
    latitudeRange = [37, 63];
    longRange = [-10, 36];
  } else {
    latitudeRange = [-50, 60];
    longRange = [-130, 160];
  }

  const baseLat = Math.random() * (latitudeRange[1] - latitudeRange[0]) + latitudeRange[0]; 
  const baseLon = Math.random() * (longRange[1] - longRange[0]) + longRange[0]; 
  console.log(`Searching for location with coordinates around: ${baseLat}, ${baseLon}`);

  const latRange = [baseLat - 0.05, baseLat + 0.05];
  const lonRange = [baseLon - 0.05, baseLon + 0.05];

  console.log(`Latitude range: ${latRange[0]} to ${latRange[1]}`);
  console.log(`Longitude range: ${lonRange[0]} to ${lonRange[1]}`);

  if (userLocationMarker) {
    map.removeLayer(userLocationMarker);
  }

  let url = `https://api.gbif.org/v1/occurrence/search?decimalLatitude=${latRange[0]},${latRange[1]}&decimalLongitude=${lonRange[0]},${lonRange[1]}&distance=${searchRadiusKm}&limit=1`;
  
  if (isUSAMode) {
    url += `&georeferenced=true`; // USA-specific filtering if needed
  }

  fetch(url)
    .then(response => response.json())
    .then(data => {
      console.log("Fetch response data:", data);
      let validResults = data.results.filter(result => result.media && result.media.length > 0);

      if (isUSAMode) {
        validResults = validResults.filter(result => 
          result.locality && (result.locality.includes('USA') || result.locality.includes('US') || result.locality.includes('United States'))
        );
      }

      if (validResults.length > 0) {
        console.log("Found valid result with media.");
        correctLocation = {
          lat: validResults[0].decimalLatitude,
          lon: validResults[0].decimalLongitude,
          media: validResults[0].media[0].identifier,
          name: validResults[0].species // Or another property if available
        };
        toggleLoadingScreen(false); // Hide loading screen when image is ready
        displayImage(correctLocation.media);
        fetchWikipediaSnippet(correctLocation.name);
      } else {
        console.log("No valid results found. Retrying...");
        setTimeout(findLocationWithPicture, 3000);
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

function fetchWikipediaSnippet(title) {
  const apiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  
  fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      if (data && data.extract) {
        displayWikipediaInfo(data.title, data.extract);
      } else {
        displayWikipediaInfo("No information available", "Sorry, no information was found for this location.");
      }
    })
    .catch(error => {
      console.error("Error fetching Wikipedia data:", error);
      displayWikipediaInfo("Error", "There was an error fetching Wikipedia data.");
    });
}

function displayWikipediaInfo(title, snippet) {
  const infoContainer = document.getElementById('infoContainer');
  infoContainer.innerHTML = `
    <h2>${title}</h2>
    <p>${snippet}</p>
    <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(title)}" target="_blank">Read more on Wikipedia</a>
    <button id="nextButton">Next</button>
  `;
  infoContainer.style.display = 'block';

  document.getElementById('nextButton').addEventListener('click', () => {
    infoContainer.style.display = 'none';
    findLocationWithPicture(); // Fetch a new image in the same round
  });
}

function handleMapClick(e) {
  if (!gameInProgress || !correctLocation) {
    console.log("Game not in progress or no correct location.");
    return;
  }

  const userLatLng = e.latlng;
  const correctLatLng = L.latLng(correctLocation.lat, correctLocation.lon);
  const distance = userLatLng.distanceTo(correctLatLng) / 1000; // Convert to kilometers
  const europe = document.getElementById('europe').checked;
  const score = calculateScore(distance, europe);
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
}

function calculateScore(distance, isEuropeMode) {
  const maxDistanceForPoints = isEuropeMode ? 1500 : 4000;
  const scoreCoefficient = isEuropeMode ? 3.3334 : 1.25;

  if (distance > maxDistanceForPoints) return 0;
  return Math.round(5000 - (distance * scoreCoefficient));
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

function toggleLoadingScreen(show) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = show ? 'flex' : 'none';
    } else {
        console.error("Loading screen element not found.");
    }
}

initializeMap();
