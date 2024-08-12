let map;
let userLat, userLon;
let markers = [];
let currentLocationMarker;
let addressMarker;
let currentThemeIndex = 0;
const themes = ['light-theme', 'dark-theme', 'green-theme', 'alt-theme', 'alt-theme2'];
let fetchStartTime;
let timeoutHandle;

// Initialize the map with user's location
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(position => {
    userLat = position.coords.latitude;
    userLon = position.coords.longitude;
    initializeMap(userLat, userLon);
  }, error => {
    alert("Unable to retrieve your location.");
    userLat = 0;
    userLon = 0;
    initializeMap(userLat, userLon);
  });
} else {
  alert("Geolocation is not supported by this browser.");
  userLat = 0;
  userLon = 0;
  initializeMap(userLat, userLon);
}

// Initialize the map
function initializeMap(lat, lon) {
  map = L.map('mapContainer').setView([lat, lon], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  currentLocationMarker = L.marker([lat, lon], {
    color: 'red',
    title: 'Your Location'
  }).addTo(map);

  map.on('click', function(e) {
    if (addressMarker) {
      map.removeLayer(addressMarker);
    }
    addressMarker = L.marker(e.latlng, { color: 'blue', title: 'Selected Location' }).addTo(map);
    updateMap();
  });

  updateMap();
}

// Fetch common name and kingdom for a given taxonKey
async function getCommonNameAndKingdom(taxonKey) {
  try {
    const response = await fetch(`https://api.gbif.org/v1/species/${taxonKey}`);
    const speciesData = await response.json();
    const vernacularNamesResponse = await fetch(`https://api.gbif.org/v1/species/${taxonKey}/vernacularNames`);
    const vernacularNamesData = await vernacularNamesResponse.json();

    let commonName = 'No common name available';
    if (vernacularNamesData && Array.isArray(vernacularNamesData.results)) {
      const englishNames = vernacularNamesData.results.filter(name => name.language === 'eng');
      if (englishNames.length > 0) {
        commonName = englishNames[0].vernacularName || 'N/A';
      }
    }

    return {
      commonName: commonName,
      kingdom: speciesData.kingdom
    };
  } catch (error) {
    console.error('Error fetching common name or kingdom:', error);
    return {
      commonName: 'No common name available',
      kingdom: 'Unknown'
    };
  }
}
// Function to fetch results for a random location
async function fetchResultsForRandomLocation(lat, lon) {
    fetchStartTime = Date.now();
    const distance = 80; // Fixed radius of 80 miles for random location
    const resultsCount = parseInt(document.getElementById('results').value) || 10;
    const kingdomFilter = document.getElementById('kingdomFilter').value;

    const milesToDegrees = 0.014;
    const distanceDegrees = distance * milesToDegrees;

    const latMin = Math.max(-60, lat - distanceDegrees);
    const latMax = Math.min(55, lat + distanceDegrees);
    const lonMin = Math.max(-180, lon - distanceDegrees);
    const lonMax = Math.min(180, lon + distanceDegrees);

    let gbifUrl = `https://api.gbif.org/v1/occurrence/search?year=2018,2024&decimalLatitude=${latMin},${latMax}&decimalLongitude=${lonMin},${lonMax}&limit=${resultsCount}`;

    const listContainer = document.getElementById('listContainer');
    listContainer.innerHTML = '';

    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    let occurrences = [];
    let additionalFetches = 0;

    // Clear previous timeout
    if (timeoutHandle) {
        clearTimeout(timeoutHandle);
    }

    // Set timeout for the fetching process
    timeoutHandle = setTimeout(() => {
        listContainer.innerHTML = '<p style="color: red;">Error: The search is taking too long. Please try again with different filters or fewer results.</p>';
    }, 100000); // 100 seconds

    while ((occurrences.length < resultsCount) && (additionalFetches < 10)) {
        const response = await fetch(gbifUrl);
        const data = await response.json();
        const fetchDetailsPromises = data.results.map(async occurrence => {
            const details = await getCommonNameAndKingdom(occurrence.taxonKey);
            return { occurrence, ...details };
        });

        const results = await Promise.all(fetchDetailsPromises);

        const filteredResults = results.filter(({ occurrence, kingdom }) => {
            return (kingdomFilter === 'all' || kingdom === kingdomFilter) &&
                   (occurrence.media && occurrence.media.length > 0);
        });

        occurrences = occurrences.concat(filteredResults);

        if (occurrences.length < resultsCount) {
            additionalFetches++;
            gbifUrl = `https://api.gbif.org/v1/occurrence/search?year=2018,2024&decimalLatitude=${latMin},${latMax}&decimalLongitude=${lonMin},${lonMax}&limit=${resultsCount}&offset=${data.offset + data.limit * additionalFetches}`;
        }

        if (Date.now() - fetchStartTime > 100000) {
            listContainer.innerHTML = '<p style="color: red;">Error: The search is taking too long. Please try again with different filters or fewer results.</p>';
            return false;
        }
    }

    clearTimeout(timeoutHandle); // Clear timeout if results are fetched in time

    if (occurrences.length === 0) {
        listContainer.innerHTML = '<p style="color: red;">No results found. Please adjust your filters.</p>';
        return false;
    }

    // Calculate distance from requested location
    const requestedLatLng = L.latLng(lat, lon);

    occurrences.forEach(({ occurrence }) => {
        const occurrenceLatLng = L.latLng(occurrence.decimalLatitude, occurrence.decimalLongitude);
        occurrence.distance = requestedLatLng.distanceTo(occurrenceLatLng);
    });

    occurrences.sort((a, b) => a.occurrence.distance - b.occurrence.distance);

    for (const { occurrence, commonName } of occurrences) {
        const occurrenceDiv = document.createElement('div');
        occurrenceDiv.className = 'occurrence';

        const speciesImage = occurrence.media && occurrence.media.length > 0 ? occurrence.media[0].identifier : '';
        const locality = occurrence.verbatimLocality || occurrence.locality || 'Locality not available';
        const distanceInKm = (occurrence.distance / 1000).toFixed(2);
        const distanceInMiles = (occurrence.distance / 1609.34).toFixed(2);
        const link = occurrence.references && occurrence.references.length > 0 ? occurrence.references[0] : '#';

        // Fetch Wikipedia snippet and link
        const wikiResponse = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&formatversion=2&srsearch=${encodeURIComponent(commonName)}&srlimit=1`);
        const wikiData = await wikiResponse.json();
        const wikiSearchResult = wikiData.query.search[0] || {};
        const wikiLink = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiSearchResult.title || commonName)}`;
        const snippet = wikiSearchResult.snippet
            ? wikiSearchResult.snippet.replace(/<\/?span[^>]*>/g, '') // Remove <span> tags from the snippet
            : 'No snippet available';

        occurrenceDiv.innerHTML = `
            <strong>${commonName}</strong><br>
            <em>${occurrence.scientificName}</em><br>
            <strong>Locality:</strong> ${locality}<br>
            <strong>Distance:</strong> ${distanceInKm} km / ${distanceInMiles} miles<br>
            <a href="${link}" target="_blank">More Info</a><br>
            <a href="${wikiLink}" target="_blank">Wikipedia</a><br>
            <p>${snippet}</p>
            ${speciesImage ? `<img src="${speciesImage}" alt="${commonName}" class="species-image">` : '<p>No image available</p>'}
        `;

        listContainer.appendChild(occurrenceDiv);

        const markerPopupContent = `
            <strong>${commonName}</strong><br>
            <em>${occurrence.scientificName}</em><br>
            <strong>Locality:</strong> ${locality}<br>
            <strong>Distance:</strong> ${distanceInKm} km / ${distanceInMiles} miles<br>
            <a href="${link}" target="_blank">More Info</a><br>
            <a href="${wikiLink}" target="_blank">Wikipedia</a><br>
            <p>${snippet}</p>
            ${speciesImage ? `<img src="${speciesImage}" alt="${commonName}" class="species-image">` : '<p>No image available</p>'}
        `;

        const marker = L.marker([occurrence.decimalLatitude, occurrence.decimalLongitude])
            .bindPopup(markerPopupContent);
        markers.push(marker);
        marker.addTo(map);
    }

    return true; // Indicate that results were found
}

// Function to fetch results based on provided coordinates
async function fetchResults(lat = userLat, lon = userLon) {
    fetchStartTime = Date.now();
    let distance = parseFloat(document.getElementById('distance').value) || 10;
    const distanceUnit = document.getElementById('distanceUnit').value;
    const resultsCount = parseInt(document.getElementById('results').value) || 10;
    const kingdomFilter = document.getElementById('kingdomFilter').value;

    const milesToDegrees = 0.014;
    const kilometersToDegrees = 0.008;
    let distanceDegrees = distanceUnit === 'miles' ? distance * milesToDegrees : distance * kilometersToDegrees;

    const latMin = lat - distanceDegrees;
    const latMax = lat + distanceDegrees;
    const lonMin = lon - distanceDegrees;
    const lonMax = lon + distanceDegrees;

    let gbifUrl = `https://api.gbif.org/v1/occurrence/search?year=2018,2024&decimalLatitude=${latMin},${latMax}&decimalLongitude=${lonMin},${lonMax}&limit=${resultsCount}`;

    const listContainer = document.getElementById('listContainer');
    listContainer.innerHTML = '';

    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    let occurrences = [];
    let additionalFetches = 0;

    // Clear previous timeout
    if (timeoutHandle) {
        clearTimeout(timeoutHandle);
    }

    // Set timeout for the fetching process
    timeoutHandle = setTimeout(() => {
        listContainer.innerHTML = '<p style="color: red;">Error: The search is taking too long. Please try again with different filters or fewer results.</p>';
    }, 100000); // 100 seconds

    while ((occurrences.length < resultsCount) && (additionalFetches < 10)) {
        const response = await fetch(gbifUrl);
        const data = await response.json();
        const fetchDetailsPromises = data.results.map(async occurrence => {
            const details = await getCommonNameAndKingdom(occurrence.taxonKey);
            return { occurrence, ...details };
        });

        const results = await Promise.all(fetchDetailsPromises);

        const filteredResults = results.filter(({ occurrence, kingdom }) => {
            return (kingdomFilter === 'all' || kingdom === kingdomFilter) &&
                   (occurrence.media && occurrence.media.length > 0);
        });

        occurrences = occurrences.concat(filteredResults);

        if (occurrences.length < resultsCount) {
            additionalFetches++;
            gbifUrl = `https://api.gbif.org/v1/occurrence/search?year=2018,2024&decimalLatitude=${latMin},${latMax}&decimalLongitude=${lonMin},${lonMax}&limit=${resultsCount}&offset=${data.offset + data.limit * additionalFetches}`;
        }

        if (Date.now() - fetchStartTime > 100000) {
            listContainer.innerHTML = '<p style="color: red;">Error: The search is taking too long. Please try again with different filters or fewer results.</p>';
            return false;
        }
    }

    clearTimeout(timeoutHandle); // Clear timeout if results are fetched in time

    if (occurrences.length === 0) {
        listContainer.innerHTML = '<p style="color: red;">No results found. Please adjust your filters.</p>';
        return false;
    }

    // Calculate distance from requested location
    const requestedLatLng = L.latLng(lat, lon);

    occurrences.forEach(({ occurrence }) => {
        const occurrenceLatLng = L.latLng(occurrence.decimalLatitude, occurrence.decimalLongitude);
        occurrence.distance = requestedLatLng.distanceTo(occurrenceLatLng);
    });

    occurrences.sort((a, b) => a.occurrence.distance - b.occurrence.distance);

    for (const { occurrence, commonName } of occurrences) {
        const occurrenceDiv = document.createElement('div');
        occurrenceDiv.className = 'occurrence';

        const speciesImage = occurrence.media && occurrence.media.length > 0 ? occurrence.media[0].identifier : '';
        const locality = occurrence.verbatimLocality || occurrence.locality || 'Locality not available';
        const distanceInKm = (occurrence.distance / 1000).toFixed(2);
        const distanceInMiles = (occurrence.distance / 1609.34).toFixed(2);
        const link = occurrence.references && occurrence.references.length > 0 ? occurrence.references[0] : '#';

        // Fetch Wikipedia snippet and link
        const wikiResponse = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&formatversion=2&srsearch=${encodeURIComponent(commonName)}&srlimit=1`);
        const wikiData = await wikiResponse.json();
        const wikiSearchResult = wikiData.query.search[0] || {};
        const wikiLink = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiSearchResult.title || commonName)}`;
        const snippet = wikiSearchResult.snippet
            ? wikiSearchResult.snippet.replace(/<\/?span[^>]*>/g, '') // Remove <span> tags from the snippet
            : 'No snippet available';

        occurrenceDiv.innerHTML = `
            <strong>${commonName}</strong><br>
            <em>${occurrence.scientificName}</em><br>
            <strong>Locality:</strong> ${locality}<br>
            <strong>Distance:</strong> ${distanceInKm} km / ${distanceInMiles} miles<br>
            <a href="${link}" target="_blank">More Info</a><br>
            <a href="${wikiLink}" target="_blank">Wikipedia</a><br>
            <p>${snippet}</p>
            ${speciesImage ? `<img src="${speciesImage}" alt="${commonName}" class="species-image">` : '<p>No image available</p>'}
        `;

        listContainer.appendChild(occurrenceDiv);

        const markerPopupContent = `
            <strong>${commonName}</strong><br>
            <em>${occurrence.scientificName}</em><br>
            <strong>Locality:</strong> ${locality}<br>
            <strong>Distance:</strong> ${distanceInKm} km / ${distanceInMiles} miles<br>
            <a href="${link}" target="_blank">More Info</a><br>
            <a href="${wikiLink}" target="_blank">Wikipedia</a><br>
            <p>${snippet}</p>
            ${speciesImage ? `<img src="${speciesImage}" alt="${commonName}" class="species-image">` : '<p>No image available</p>'}
        `;

        const marker = L.marker([occurrence.decimalLatitude, occurrence.decimalLongitude])
            .bindPopup(markerPopupContent);
        markers.push(marker);
        marker.addTo(map);
    }

    return true; // Indicate that results were found
}




// Update map based on selected address or random location
function updateMap() {
  if (addressMarker) {
    userLat = addressMarker.getLatLng().lat;
    userLon = addressMarker.getLatLng().lng;
  }
  fetchResults(userLat, userLon);
}

// Change the theme of the application
function changeTheme() {
  const body = document.body;
  body.classList.remove(themes[currentThemeIndex]);
  currentThemeIndex = (currentThemeIndex + 1) % themes.length;
  body.classList.add(themes[currentThemeIndex]);
}
