# AURA Healthcare: Advanced Smart Queue & Geolocation Hospital Locator

A premium, state-of-the-art medical dispatch and routing dashboard built with **Flask**, **Leaflet.js**, **OpenCV**, and **YOLOv8**. Aura Healthcare tracks user coordinates in real-time, displays nearby hospitals, details their specialties and ratings, calculates exact physical distances, and enables intelligent remote queue registration with AI-powered symptom triage.

---

## ✨ Features

- 📍 **Real-Time GPS Tracking & Mapping**: Leverages HTML5 Geolocation API with a Leaflet.js interactive dark-themed map overlay showing a pulsing user locator dot.
- 🗺️ **Dynamic Coordinate Re-Anchoring**: Automatic backend adjustments cluster hospital locations within a 2–8 km radius of the user's exact tracked coordinates anywhere in the world.
- 🧬 **Intelligent Symptom Triage (NLP)**: Multi-label classification models analyze complaints to route patients to correct hospital departments (**Cardiology, Pulmonology, Orthopedics, Pediatrics, or General Medicine**) and assign priority queue rankings (**Emergency 🚨, Priority ⚠️, Regular**).
- 👥 **YOLOv8 CCTV Crowd Analyzer**: Live OpenCV person counts from security camera video frames using YOLOv8 neural weights (`yolov8n.pt`). Includes a dynamic hour-of-the-day sine-wave fallback simulator.
- ⏱️ **Real-Time Telemetry Feed (SSE)**: Uses Server-Sent Events to continuously stream live crowd density and queue wait-time fluctuations directly to the UI.
- 🎫 **Glassmorphism Wallet Tickets**: Displays elegant glassmorphic digital queue tokens styled for Apple Wallet/Google Pay, featuring custom pixel-matrix mock QR codes and estimated check-in timers.

---

## 🛠️ Technology Stack

- **Backend**: Python 3, Flask, SQLite3, Scikit-Learn
- **Computer Vision**: OpenCV, Ultralytics YOLOv8
- **Frontend**: HTML5, Vanilla CSS3 (Custom Glassmorphism), JavaScript (ES6+)
- **Mapping**: Leaflet.js (Dark Mode Tiles via CartoDB)
- **Typography & Icons**: Google Fonts (Outfit, Plus Jakarta Sans)

---

## 📂 Project Architecture

```
advanced-smart-hospital-queue-locator/
│
├── app.py                      # Flask Server Core, Database Seeds & SSE Routes
├── nlp_engine.py               # AI Symptom Department Classifier & Urgency Triage
├── crowd_analyzer.py           # YOLOv8 Computer Vision Person Counter & Fallback Simulator
├── requirements.txt            # Python Dependencies
├── yolov8n.pt                  # YOLOv8 Neural Weights
├── hospital_advanced.db        # SQLite Database (Auto-created on launch)
│
├── templates/
│   └── index.html              # Responsive Glassmorphic HTML Dashboard
│
└── static/
    ├── css/
    │   └── style.css           # Premium Layout Stylesheet & Glowing Fluid Keyframes
    └── js/
        ├── map.js              # Leaflet Map Layer Wrapper & Path Vector Drawing
        └── app.js              # Geolocation, Dynamic Search, Registration, and SSE Telemetry
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have **Python 3.10+** installed on your machine.

### 1. Install Dependencies
Navigate to your project directory and install the required libraries:
```bash
pip install -r requirements.txt
```

### 2. Launch the Application
Start the Flask development server:
```bash
python app.py
```

### 3. Open the Application
Navigate to your web browser and load:
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 💡 How to Interact with the System

1. **Locate Nearby Healthcare**: 
   Allow location permissions in your browser to watch the dark-map zoom to your exact GPS coordinates. Click on any hospital pin to draw a direct path link.
2. **Dynamic Search & Filters**: 
   Type symptoms (e.g., `"chest"`) in the search bar or sort by rating/distance.
3. **Trigger YOLO CCTV**: 
   Click `"Trigger CCTV Crowd Counter (YOLO)"` on any hospital card. The backend will grab a frame, feed it to YOLOv8, count active people, and update wait-times.
4. **Join a Remote Queue**: 
   Select a hospital, enter your details and symptoms (e.g., *"Child has a high fever"*), and click **Generate Smart Queue Ticket**. Our NLP classifier will triage you and issue a digital QR ticket instantly.
