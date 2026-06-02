import os
import math
import sqlite3
import random
import time
from flask import Flask, render_template, request, jsonify, Response
from nlp_engine import predict_symptoms
from crowd_analyzer import CrowdAnalyzer

app = Flask(__name__)
crowd_analyzer = CrowdAnalyzer()

# Database Helper
DB_PATH = "hospital_advanced.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()
    
    # Create Hospitals table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS hospitals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        latitude REAL,
        longitude REAL,
        specialties TEXT,
        rating REAL,
        address TEXT,
        contact TEXT,
        crowd_level INTEGER,
        avg_wait_minutes INTEGER
    )
    """)
    
    # Create Patients table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital_id INTEGER,
        name TEXT,
        problem TEXT,
        urgency TEXT,
        department TEXT,
        queue_number INTEGER,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
    )
    """)
    
    # Seed default hospitals (Centered around a generic point in India, e.g. Hyderabad: 17.3850, 78.4867)
    # We will dynamically adjust these coordinates in the API if the user provides their exact location!
    default_hospitals = [
        ("Apollo Smart Health City", 17.4124, 78.4026, "Cardiology, Orthopedics, General Medicine, Emergency, Neurology", 4.8, "Jubilee Hills, Road No 72, Hyderabad", "+91 40 2360 7777", 25, 12),
        ("Care Specialty Hospital", 17.4192, 78.4485, "Cardiology, Pulmonology, General Medicine, Pediatrics", 4.6, "Banjara Hills, Road No 1, Hyderabad", "+91 40 6165 6565", 18, 8),
        ("KIMS Multi-Specialty Institute", 17.4332, 78.4862, "Neurology, Pediatrics, Orthopedics, Cardiology, Emergency", 4.7, "Minister Road, Secunderabad", "+91 40 4488 5000", 35, 18),
        ("Rainbow Childrens Hospital", 17.4294, 78.4112, "Pediatrics, General Medicine, Pulmonology", 4.9, "Jubilee Hills, Road No 2, Hyderabad", "+91 40 2207 4444", 12, 5),
        ("Yasoda Medical Center", 17.4221, 78.4552, "Emergency, General Medicine, Orthopedics, Pulmonology", 4.5, "Somajiguda, Raj Bhavan Road, Hyderabad", "+91 40 2455 5555", 22, 10)
    ]
    
    for hosp in default_hospitals:
        try:
            cur.execute("""
            INSERT OR IGNORE INTO hospitals (name, latitude, longitude, specialties, rating, address, contact, crowd_level, avg_wait_minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, hosp)
        except Exception as e:
            print(f"[DB] Error seeding hospital: {e}")
            
    conn.commit()
    conn.close()

# Initialize database
init_db()

# Haversine Distance Formula
def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371.0  # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# -----------------------------
# Frontend Routes
# -----------------------------
@app.route("/")
def index():
    # Returns crowd count of primary camera
    primary_crowd = crowd_analyzer.count_people_live()
    return render_template("index.html", primary_crowd=primary_crowd)

# -----------------------------
# API Routes
# -----------------------------
@app.route("/api/hospitals", methods=["GET"])
def get_hospitals():
    user_lat = request.args.get("lat", type=float)
    user_lon = request.args.get("lon", type=float)
    search_query = request.args.get("q", default="", type=str).lower()
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM hospitals")
    hospitals = [dict(row) for row in cur.fetchall()]
    conn.close()
    
    # ADVANCED FEATURE: If the user provides a real location that is far from Hyderabad,
    # we dynamically re-anchor the hospitals around the user's location so the map is fully functional!
    if user_lat is not None and user_lon is not None:
        # Check if the closest default hospital is more than 50km away (meaning they are in a different city/country)
        closest_dist = min([calculate_distance(user_lat, user_lon, h["latitude"], h["longitude"]) for h in hospitals])
        
        if closest_dist > 50.0:
            print(f"[GPS] User is located at ({user_lat}, {user_lon}) which is far from DB. Dynamically re-anchoring hospitals...")
            conn = get_db()
            cur = conn.cursor()
            
            # Re-scale coordinates to cluster within 2-8 km of the user
            offsets = [
                (0.015, -0.020), # North-West
                (0.028, 0.015),  # North-East
                (-0.012, 0.038), # East
                (-0.032, -0.012),# South-West
                (0.005, 0.025)   # Central-East
            ]
            
            for index, h in enumerate(hospitals):
                new_lat = user_lat + offsets[index][0]
                new_lon = user_lon + offsets[index][1]
                cur.execute("UPDATE hospitals SET latitude = ?, longitude = ? WHERE id = ?", (new_lat, new_lon, h["id"]))
                h["latitude"] = new_lat
                h["longitude"] = new_lon
                
            conn.commit()
            conn.close()

    # Calculate real distances, filter specialties, and sort
    filtered_hospitals = []
    for h in hospitals:
        # Filter by search query (name or specialties)
        if search_query and (search_query not in h["name"].lower() and search_query not in h["specialties"].lower()):
            continue
            
        if user_lat is not None and user_lon is not None:
            h["distance_km"] = round(calculate_distance(user_lat, user_lon, h["latitude"], h["longitude"]), 2)
        else:
            h["distance_km"] = None
            
        filtered_hospitals.append(h)
        
    # Sort by distance if available, otherwise by rating
    if user_lat is not None and user_lon is not None:
        filtered_hospitals.sort(key=lambda x: x["distance_km"])
    else:
        filtered_hospitals.sort(key=lambda x: x["rating"], reverse=True)
        
    return jsonify(filtered_hospitals)

@app.route("/api/register", methods=["POST"])
def register_patient():
    data = request.json
    name = data.get("name")
    problem = data.get("problem")
    hospital_id = data.get("hospital_id")
    
    if not name or not problem or not hospital_id:
        return jsonify({"error": "Missing required fields"}), 400
        
    # NLP Triage
    urgency, department = predict_symptoms(problem)
    
    conn = get_db()
    cur = conn.cursor()
    
    # Calculate queue number for the specific hospital
    cur.execute("SELECT COUNT(*) FROM patients WHERE hospital_id = ?", (hospital_id,))
    queue_count = cur.fetchone()[0]
    queue_number = queue_count + 1
    
    # Insert patient
    cur.execute("""
    INSERT INTO patients (hospital_id, name, problem, urgency, department, queue_number)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (hospital_id, name, problem, urgency, department, queue_number))
    
    # Retrieve hospital info to calculate live waiting time
    cur.execute("SELECT * FROM hospitals WHERE id = ?", (hospital_id,))
    hosp = dict(cur.fetchone())
    
    # Add wait time dynamically based on urgency:
    # High: Immediate / 0-5 mins
    # Medium: 15-30 mins
    # Low: 45-60 mins
    wait_multiplier = 2 if urgency == "Low" else (1 if urgency == "Medium" else 0.2)
    est_wait = max(5, int(queue_number * hosp["avg_wait_minutes"] * wait_multiplier))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True,
        "patient": {
            "name": name,
            "problem": problem,
            "urgency": urgency,
            "department": department,
            "queue_number": queue_number,
            "est_wait_minutes": est_wait,
            "hospital_name": hosp["name"]
        }
    })

@app.route("/api/queues/<int:hospital_id>", methods=["GET"])
def get_queue(hospital_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM patients WHERE hospital_id = ? ORDER BY id DESC", (hospital_id,))
    queue = [dict(row) for row in cur.fetchall()]
    conn.close()
    return jsonify(queue)

@app.route("/api/trigger-yolo/<int:hospital_id>", methods=["GET"])
def trigger_yolo(hospital_id):
    """
    Simulates triggering YOLO on a security camera of the specific hospital.
    """
    live_count = crowd_analyzer.count_people_live()
    
    # Update hospital database
    conn = get_db()
    cur = conn.cursor()
    # Calculate average wait based on live count
    avg_wait = max(4, int(live_count * 0.5))
    cur.execute("UPDATE hospitals SET crowd_level = ?, avg_wait_minutes = ? WHERE id = ?", (live_count, avg_wait, hospital_id))
    conn.commit()
    conn.close()
    
    return jsonify({
        "hospital_id": hospital_id,
        "live_crowd_count": live_count,
        "avg_wait_minutes": avg_wait
    })

# Server Sent Events (SSE) telemetry feed
@app.route("/api/stream-crowd")
def stream_crowd():
    def event_stream():
        while True:
            # Periodically fluctuate hospital crowd values to simulate live telemetry feeds!
            conn = get_db()
            cur = conn.cursor()
            cur.execute("SELECT id, name, crowd_level FROM hospitals")
            hospitals = cur.fetchall()
            
            updates = []
            for h in hospitals:
                # Add slight fluctuations
                delta = random.choice([-2, -1, 0, 1, 2])
                new_crowd = max(5, min(60, h["crowd_level"] + delta))
                avg_wait = max(4, int(new_crowd * 0.5))
                cur.execute("UPDATE hospitals SET crowd_level = ?, avg_wait_minutes = ? WHERE id = ?", (new_crowd, avg_wait, h["id"]))
                
                updates.append({
                    "id": h["id"],
                    "name": h["name"],
                    "crowd_level": new_crowd,
                    "avg_wait_minutes": avg_wait
                })
                
            conn.commit()
            conn.close()
            
            # Format and send SSE payload
            import json
            yield f"data: {json.dumps(updates)}\n\n"
            time.sleep(12)  # update every 12 seconds
            
    return Response(event_stream(), mimetype="text/event-stream")

import os

if __name__ == "__main__":
    if os.environ.get("STREAMLIT_CLOUD") != "true":
        app.run(debug=False, host="0.0.0.0", port=5000, use_reloader=False)