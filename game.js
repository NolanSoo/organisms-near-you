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
const latitudeRange = [-50, 60]; // Latitude range (50°S to 60°N)
const longitudeRange = [-130, 160]; // Full longitude range
const memeImages = {
  low: ["lowscore1.jpg", "lowscore2.jpg"], // 0-499 pts
  mid: ["midscore1.jpg", "mid2.gif"], // 500-2499 pts
  high: ["high.jpg", "high2.jpg"], // 2500-4399 pts
  top: ["top.jpg", "top2.png"] // 4400-5000 pts
};


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

function startNewRound(score) {
  if (currentRound >= 4) {
    console.log("Ending game after 4 rounds.");
    endGame();
    return;
  }

  console.log(`Starting round ${currentRound + 1}`);
  currentRound++;
  toggleLoadingScreen(true, score); // Show loading screen while searching for a location
  findLocationWithPicture();
}

function findLocationWithPicture() {
  let latitudeRange, longitudeRange;

  if (document.getElementById('europe').checked) {
    latitudeRange = [37, 63];
    longitudeRange = [-10, 36];
  } else if (document.getElementById('asia').checked) {
    latitudeRange = [11, 59];
    longitudeRange = [43, 120];
  } else if (document.getElementById('usacanada').checked) {
    latitudeRange = [32, 57];
    longitudeRange = [-124, -63];
  } else {
    latitudeRange = [-50, 60];
    longitudeRange = [-130, 160];
  }

  const baseLat = Math.random() * (latitudeRange[1] - latitudeRange[0]) + latitudeRange[0];
  const baseLon = Math.random() * (longitudeRange[1] - longitudeRange[0]) + longitudeRange[0];
  console.log(`Searching for location with coordinates around: ${baseLat}, ${baseLon}`);

  const latRange = [baseLat - 0.05, baseLat + 0.05];
  const lonRange = [baseLon - 0.05, baseLon + 0.05];

  console.log(`Latitude range: ${latRange[0]} to ${latRange[1]}`);
  console.log(`Longitude range: ${lonRange[0]} to ${lonRange[1]}`);

  if (userLocationMarker) {
    map.removeLayer(userLocationMarker);
  }

  const url = `https://api.gbif.org/v1/occurrence/search?decimalLatitude=${latRange[0]},${latRange[1]}&decimalLongitude=${lonRange[0]},${lonRange[1]}&distance=${searchRadiusKm}&limit=1`;

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

  if (currentRound >= 4) {
    endGame();
  } else {
    startNewRound(score);
  }
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

function toggleLoadingScreen(show, score = null) {
  const loadingScreen = document.getElementById('loadingScreen');
  const memeCheck = document.getElementById('memeCheck').checked;

  if (loadingScreen) {
    if (show) {
      if (!memeCheck || score === null) {
        // Use default loading gif if memeCheck is not checked or for the first round
        loadingScreen.innerHTML = `<img src="loading.gif" alt="Loading" style="width: 100%; height: auto;">`;
      } else {
        // Meme check is on, display meme based on score
        let memeCategory;

        if (score <= 499) {
          memeCategory = memeImages.low;
        } else if (score <= 2499) {
          memeCategory = memeImages.mid;
        } else if (score <= 4099) {
          memeCategory = memeImages.high;
        } else {
          memeCategory = memeImages.top;
        }

        const randomMeme = memeCategory[Math.floor(Math.random() * memeCategory.length)];
        loadingScreen.innerHTML = `<img src="${randomMeme}" alt="Meme" style="width: 100%; height: auto;">`;
      }
      loadingScreen.style.display = 'flex';
    } else {
      loadingScreen.style.display = 'none';
    }
  } else {
    console.error("Loading screen element not found.");
  }
}

initializeMap();

