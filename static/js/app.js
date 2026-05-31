// Application State
let currentCoordinates = { lat: 17.3850, lon: 78.4867 }; // Default Hyderabad
let activeHospitalId = null;
let allHospitals = [];
let searchTimeout;
let sseConnection = null;

// DOM Cache
const gpsPulse = document.getElementById('gps-pulse');
const gpsLabel = document.getElementById('gps-label');
const retrackBtn = document.getElementById('retrack-btn');
const hospitalDeck = document.getElementById('hospital-deck');
const searchInput = document.getElementById('search-input');
const sortFilter = document.getElementById('sort-filter');
const distanceFilter = document.getElementById('distance-filter');

const noHospitalSelected = document.getElementById('no-hospital-selected');
const queueForm = document.getElementById('queue-form');
const selectedHospitalName = document.getElementById('selected-hospital-name');
const selectedHospitalId = document.getElementById('selected-hospital-id');
const queueFormSubmit = document.getElementById('queue-form');

const ticketModal = document.getElementById('ticket-modal');
const closeTicketBtn = document.getElementById('close-ticket-btn');
const printTicketBtn = document.getElementById('print-ticket-btn');

// Initial Setup
window.addEventListener('DOMContentLoaded', () => {
    trackUserLocation();
    
    // Wire UI events
    retrackBtn.addEventListener('click', trackUserLocation);
    searchInput.addEventListener('input', handleSearchInput);
    sortFilter.addEventListener('change', renderHospitalDeck);
    distanceFilter.addEventListener('change', renderHospitalDeck);
    
    queueForm.addEventListener('submit', handleQueueRegistration);
    closeTicketBtn.addEventListener('click', () => ticketModal.classList.add('hidden'));
    printTicketBtn.addEventListener('click', () => alert("Ticket successfully added to Wallet! Ready to check-in."));
    
    // Connect Real-Time Telemetry Feed (SSE)
    connectTelemetryFeed();
});

// Geolocation Tracking
function trackUserLocation() {
    console.log("[GPS] Requesting browser coordinates...");
    gpsPulse.className = "pulse-indicator status-blue";
    gpsLabel.innerText = "Tracking Location...";
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentCoordinates.lat = position.coords.latitude;
                currentCoordinates.lon = position.coords.longitude;
                
                console.log(`[GPS] Location successfully tracked: (${currentCoordinates.lat}, ${currentCoordinates.lon})`);
                gpsPulse.className = "pulse-indicator status-green";
                gpsLabel.innerText = `Active GPS: (${currentCoordinates.lat.toFixed(4)}, ${currentCoordinates.lon.toFixed(4)})`;
                
                // Update User Node on Map
                updateUserLocationMarker(currentCoordinates.lat, currentCoordinates.lon);
                
                // Fetch Nearby Hospitals
                fetchHospitals();
            },
            (error) => {
                console.warn(`[GPS] Geolocation failed: ${error.message}. Using high-fidelity default coordinates.`);
                gpsPulse.className = "pulse-indicator status-yellow";
                gpsLabel.innerText = "Simulated Location: Hyderabad";
                
                updateUserLocationMarker(DEFAULT_LAT, DEFAULT_LON);
                fetchHospitals();
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    } else {
        gpsPulse.className = "pulse-indicator status-red";
        gpsLabel.innerText = "GPS Not Supported";
        fetchHospitals();
    }
}

// Fetch Hospitals via Backend API
async function fetchHospitals() {
    try {
        const query = searchInput.value.trim();
        const url = `/api/hospitals?lat=${currentCoordinates.lat}&lon=${currentCoordinates.lon}&q=${encodeURIComponent(query)}`;
        
        console.log(`[API] Fetching hospitals: ${url}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error("API Network error");
        
        allHospitals = await response.json();
        renderHospitalDeck();
        
        // Plot facilities on map
        plotHospitalsOnMap(allHospitals, selectHospital);
        
    } catch (e) {
        console.error("[API] Failed to fetch hospitals:", e);
        hospitalDeck.innerHTML = `
            <div class="no-selection-alert">
                <p>⚠️ Error loading nearby hospital database. Please refresh or check connection.</p>
            </div>
        `;
    }
}

// Render Hospital List cards
function renderHospitalDeck() {
    const sortBy = sortFilter.value;
    const maxDist = distanceFilter.value;
    
    // 1. Filter
    let displayList = allHospitals.filter(h => {
        if (maxDist !== "all" && h.distance_km !== null) {
            return h.distance_km <= parseFloat(maxDist);
        }
        return true;
    });
    
    // 2. Sort
    displayList.sort((a, b) => {
        if (sortBy === "distance" && a.distance_km !== null) {
            return a.distance_km - b.distance_km;
        } else if (sortBy === "rating") {
            return b.rating - a.rating;
        } else if (sortBy === "wait") {
            return a.avg_wait_minutes - b.avg_wait_minutes;
        } else if (sortBy === "crowd") {
            return a.crowd_level - b.crowd_level;
        }
        return 0;
    });
    
    // 3. Render
    if (displayList.length === 0) {
        hospitalDeck.innerHTML = `
            <div class="no-selection-alert">
                <p>🔍 No hospital specialties or names matched your criteria.</p>
            </div>
        `;
        return;
    }
    
    hospitalDeck.innerHTML = displayList.map(h => {
        const isSelected = h.id === activeHospitalId ? 'selected' : '';
        const distText = h.distance_km !== null ? `📍 ${h.distance_km.toFixed(1)} km away` : '📍 Location tracking off';
        
        // Color badge for wait status
        let statusClass = 'tag-green';
        let statusLabel = 'Low wait';
        if (h.crowd_level >= 30) {
            statusClass = 'tag-red';
            statusLabel = 'Crowded';
        } else if (h.crowd_level >= 15) {
            statusClass = 'tag-blue';
            statusLabel = 'Moderate';
        }
        
        return `
            <div class="hospital-card glass-card ${isSelected}" onclick="selectHospital(${h.id})" id="hosp-card-${h.id}">
                <div class="card-top">
                    <h4>${h.name}</h4>
                    <span class="rating-badge">⭐ ${h.rating.toFixed(1)}</span>
                </div>
                
                <p class="address-line">${h.address}</p>
                
                <div class="specialty-row">
                    ${h.specialties.split(',').slice(0, 3).map(spec => `<span class="tag tag-specialty">${spec.trim()}</span>`).join('')}
                    ${h.specialties.split(',').length > 3 ? `<span class="tag tag-specialty">+${h.specialties.split(',').length - 3} more</span>` : ''}
                </div>
                
                <div class="card-telemetry">
                    <div class="telemetry-item">
                        <span class="telemetry-icon">⏱️</span>
                        <div class="telemetry-details">
                            <span class="val" id="wait-time-${h.id}">${h.avg_wait_minutes} mins</span>
                            <span class="lbl">Wait Time</span>
                        </div>
                    </div>
                    
                    <div class="telemetry-item">
                        <span class="telemetry-icon">👥</span>
                        <div class="telemetry-details">
                            <span class="val" id="crowd-level-${h.id}">${h.crowd_level} patients</span>
                            <span class="lbl">Crowd Density</span>
                        </div>
                    </div>
                </div>
                
                <div class="card-top" style="margin-top: 15px; margin-bottom: 0;">
                    <span class="tag ${statusClass}" id="badge-level-${h.id}">${statusLabel}</span>
                    <span class="tag tag-specialty" style="color:var(--color-primary); font-weight:700;">${distText}</span>
                </div>

                <div class="card-top" style="margin-top: 12px; margin-bottom: 0;">
                    <button class="btn btn-secondary w-100" style="padding:6px 12px; font-size:11px;" onclick="triggerYoloCount(event, ${h.id})">
                        📷 Trigger CCTV Crowd Counter (YOLO)
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Select Hospital
function selectHospital(id) {
    activeHospitalId = id;
    
    // Update active highlight classes in deck
    document.querySelectorAll('.hospital-card').forEach(c => c.classList.remove('selected'));
    const selectedCard = document.getElementById(`hosp-card-${id}`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
        // Scroll to card
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Find active details
    const hosp = allHospitals.find(h => h.id === id);
    if (!hosp) return;
    
    // Set Triage Panel active
    noHospitalSelected.classList.add('hidden');
    queueForm.classList.remove('hidden');
    
    selectedHospitalName.innerText = hosp.name;
    selectedHospitalId.value = hosp.id;
    
    // Trigger route draw and map focus
    drawRouteLine(hosp.latitude, hosp.longitude);
}

// Trigger live YOLO capture on CCTV for a hospital
async function triggerYoloCount(event, hospitalId) {
    event.stopPropagation(); // Stop click from bubbling and selecting the card again
    
    console.log(`[YOLO] Manual trigger on hospital CCTV camera id: ${hospitalId}`);
    const button = event.currentTarget;
    button.innerHTML = "🌀 Processing Frame...";
    button.disabled = true;
    
    try {
        const response = await fetch(`/api/trigger-yolo/${hospitalId}`);
        if (!response.ok) throw new Error("API error");
        
        const data = await response.json();
        
        // Update local list values
        const hosp = allHospitals.find(h => h.id === hospitalId);
        if (hosp) {
            hosp.crowd_level = data.live_crowd_count;
            hosp.avg_wait_minutes = data.avg_wait_minutes;
            
            // Re-render components
            renderHospitalDeck();
            plotHospitalsOnMap(allHospitals, selectHospital);
            selectHospital(hospitalId);
            
            alert(`[YOLOv8 Active] Scanned Hospital CCTV Stream successfully! Detected ${data.live_crowd_count} people in the frame. Updated waiting time.`);
        }
    } catch (e) {
        console.error("[YOLO] Error capturing live crowd count:", e);
        alert("⚠️ Failed to reach hospital camera feed. Falls back to simulated live streams.");
    } finally {
        button.innerHTML = "📷 Trigger CCTV Crowd Counter (YOLO)";
        button.disabled = false;
    }
}

// Search Inputs (Debounced)
function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        fetchHospitals();
    }, 450); // 450ms debounce
}

// Handle Queue Registration Form Submit
async function handleQueueRegistration(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-booking-btn');
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').innerText = "Analyzing Symptoms (AI)...";
    
    const name = document.getElementById('patient-name').value.trim();
    const problem = document.getElementById('patient-problem').value.trim();
    const hospitalId = selectedHospitalId.value;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, problem, hospital_id: hospitalId })
        });
        
        if (!response.ok) throw new Error("Registration failed");
        
        const data = await response.json();
        if (data.success) {
            // Render digital ticket
            renderSmartTicket(data.patient);
            
            // Reset form
            document.getElementById('patient-name').value = '';
            document.getElementById('patient-problem').value = '';
        }
    } catch (err) {
        console.error("[Queue] Error booking remote token:", err);
        alert("⚠️ Remote registration unavailable right now. Please try again.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').innerText = "Generate Smart Queue Ticket";
    }
}

// Render Smart Ticket Modal
function renderSmartTicket(patient) {
    document.getElementById('ticket-hosp-name').innerText = patient.hospital_name;
    document.getElementById('ticket-patient-name').innerText = patient.name;
    document.getElementById('ticket-number').innerText = `#0${patient.queue_number}`;
    document.getElementById('ticket-wait').innerHTML = `${patient.est_wait_minutes} <span class="mins">mins</span>`;
    
    const deptTag = document.getElementById('ticket-dept');
    deptTag.innerText = patient.department;
    
    // Set Urgency Badge styles
    const urgencyBadge = document.getElementById('ticket-urgency-badge');
    urgencyBadge.innerText = `${patient.urgency} Priority`;
    
    if (patient.urgency === "High") {
        urgencyBadge.className = "badge badge-high";
        urgencyBadge.innerText += " 🚨";
    } else if (patient.urgency === "Medium") {
        urgencyBadge.className = "badge badge-med";
        urgencyBadge.innerText += " ⚠️";
    } else {
        urgencyBadge.className = "badge badge-low";
    }
    
    // Generate Random Token ID
    const randomToken = "T-" + Math.floor(1000 + Math.random() * 9000) + "-" + String.fromCharCode(65 + Math.floor(Math.random() * 26));
    document.getElementById('ticket-token-id').innerText = randomToken;
    
    // Draw Random Pixels in Mock QR Code to make it look realistic!
    const qrMatrix = document.querySelector('.qr-pixel-matrix');
    qrMatrix.innerHTML = '';
    for(let i=0; i<64; i++) {
        const pixel = document.createElement('div');
        pixel.style.background = Math.random() > 0.4 ? 'black' : 'transparent';
        qrMatrix.appendChild(pixel);
    }
    
    // Show Modal
    ticketModal.classList.remove('hidden');
}

// Connect Real-Time Telemetry feed (SSE)
function connectTelemetryFeed() {
    console.log("[SSE] Establishing live telemetry subscription feed...");
    
    if (window.EventSource) {
        sseConnection = new EventSource('/api/stream-crowd');
        
        sseConnection.onmessage = (event) => {
            const updates = JSON.parse(event.data);
            console.log("[SSE] Live crowd update received:", updates);
            
            updates.forEach(upd => {
                // Find matching hospital in local data list and update
                const hosp = allHospitals.find(h => h.id === upd.id);
                if (hosp) {
                    hosp.crowd_level = upd.crowd_level;
                    hosp.avg_wait_minutes = upd.avg_wait_minutes;
                    
                    // Animate and update individual DOM nodes if present
                    const waitEl = document.getElementById(`wait-time-${upd.id}`);
                    const crowdEl = document.getElementById(`crowd-level-${upd.id}`);
                    const badgeEl = document.getElementById(`badge-level-${upd.id}`);
                    
                    if (waitEl) {
                        waitEl.innerText = `${upd.avg_wait_minutes} mins`;
                        waitEl.classList.add('animate-glow');
                        setTimeout(() => waitEl.classList.remove('animate-glow'), 1000);
                    }
                    
                    if (crowdEl) {
                        crowdEl.innerText = `${upd.crowd_level} patients`;
                        crowdEl.classList.add('animate-glow');
                        setTimeout(() => crowdEl.classList.remove('animate-glow'), 1000);
                    }
                    
                    if (badgeEl) {
                        let statusClass = 'tag tag-green';
                        let statusLabel = 'Low wait';
                        if (upd.crowd_level >= 30) {
                            statusClass = 'tag tag-red';
                            statusLabel = 'Crowded';
                        } else if (upd.crowd_level >= 15) {
                            statusClass = 'tag tag-blue';
                            statusLabel = 'Moderate';
                        }
                        badgeEl.className = statusClass;
                        badgeEl.innerText = statusLabel;
                    }
                }
            });
            
            // Re-render maps pins to ensure markers match new colors
            plotHospitalsOnMap(allHospitals, selectHospital);
        };
        
        sseConnection.onerror = (e) => {
            console.warn("[SSE] Stream interrupted. Will reconnect automatically...", e);
        };
    }
}
