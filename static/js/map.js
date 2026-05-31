// Global Map and Marker Variables
let map;
let userMarker;
let hospitalMarkers = [];
let routeLine;

// Default map view centered in Hyderabad (or dynamic based on GPS)
const DEFAULT_LAT = 17.3850;
const DEFAULT_LON = 78.4867;

function initMap() {
    console.log("[MAP] Initializing Leaflet Map...");
    
    // Create Map instance
    map = L.map('map', {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView([DEFAULT_LAT, DEFAULT_LON], 13);
    
    // Add custom styled Dark Theme map tiles (from CartoDB)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);
}

function updateUserLocationMarker(lat, lon) {
    if (!map) return;
    
    // Custom Pulsing DivIcon for User GPS
    const gpsIcon = L.divIcon({
        className: 'user-gps-marker',
        html: '<div class="pulsing-gps-dot"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    });
    
    if (userMarker) {
        userMarker.setLatLng([lat, lon]);
    } else {
        userMarker = L.marker([lat, lon], { icon: gpsIcon }).addTo(map);
        userMarker.bindPopup("<b>You are here</b><br>Currently Tracking your live position").openPopup();
    }
    
    // Pan smoothly to user's location if it's the first track
    map.setView([lat, lon], 13);
}

function plotHospitalsOnMap(hospitals, selectCallback) {
    if (!map) return;
    
    // Clear old markers
    hospitalMarkers.forEach(marker => map.removeLayer(marker));
    hospitalMarkers = [];
    
    hospitals.forEach(h => {
        // Color marker pin based on crowd intensity:
        // Low (<15) = Green, Medium (15-30) = Orange, High (>30) = Red
        let markerColor = "#10b981"; // success green
        if (h.crowd_level >= 30) {
            markerColor = "#ef4444"; // danger red
        } else if (h.crowd_level >= 15) {
            markerColor = "#f59e0b"; // warning orange
        }
        
        // Custom Styled SVG Hospital Pin
        const hospitalIconSvg = `
            <svg width="32" height="42" viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg">
                <path d="M49 98.2c-2.4 0-4.6-.9-6.3-2.5C31.5 84.5 20.8 70.4 17 56.4c-4.9-18.4 2.8-37.4 19.3-46 16.5-8.5 36.3-4.5 48 9.7 11.8 14.2 11.2 34.6-1.3 48.1L55.3 95.7c-1.7 1.6-3.9 2.5-6.3 2.5z" fill="${markerColor}" stroke="#ffffff" stroke-width="3"/>
                <circle cx="49" cy="42" r="28" fill="#ffffff"/>
                <path d="M49 26v32M33 42h32" stroke="${markerColor}" stroke-width="10" stroke-linecap="round"/>
            </svg>
        `;
        
        const customIcon = L.divIcon({
            className: 'hospital-marker',
            html: `<div style="width:32px;height:42px;filter:drop-shadow(0px 4px 8px rgba(0,0,0,0.5))">${hospitalIconSvg}</div>`,
            iconSize: [32, 42],
            iconAnchor: [16, 42],
            popupAnchor: [0, -40]
        });
        
        const marker = L.marker([h.latitude, h.longitude], { icon: customIcon }).addTo(map);
        
        const popupContent = `
            <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px;">
                <h4 style="margin:0 0 4px;font-family:'Outfit';font-weight:700;color:white;font-size:14px;">${h.name}</h4>
                <p style="margin:0 0 8px;font-size:11px;color:#9ca3af;">⭐ ${h.rating} Rating</p>
                <div style="display:flex; gap: 8px; font-size:10px;">
                    <span style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;color:white;">⏱️ ${h.avg_wait_minutes}m wait</span>
                    <span style="background:rgba(56,189,248,0.1);padding:2px 6px;border-radius:4px;color:#38bdf8;">👥 ${h.crowd_level} patients</span>
                </div>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        
        // Listen to marker click events
        marker.on('click', () => {
            selectCallback(h.id);
            drawRouteLine(h.latitude, h.longitude);
        });
        
        hospitalMarkers.push(marker);
    });
}

function drawRouteLine(destLat, destLon) {
    if (!map || !userMarker) return;
    
    const userLatLng = userMarker.getLatLng();
    const destLatLng = [destLat, destLon];
    
    // Clear old line
    if (routeLine) {
        map.removeLayer(routeLine);
    }
    
    // Draw animated route link
    routeLine = L.polyline([userLatLng, destLatLng], {
        color: '#38bdf8',
        weight: 3,
        dashArray: '8, 8',
        lineCap: 'round',
        opacity: 0.8
    }).addTo(map);
    
    // Zoom/Pan map to fit user and hospital in the view
    const bounds = L.latLngBounds([userLatLng, destLatLng]);
    map.fitBounds(bounds, { padding: [50, 50] });
}

// Global script load validation
window.addEventListener('DOMContentLoaded', () => {
    initMap();
});
