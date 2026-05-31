import cv2
import time
import math
import random
from ultralytics import YOLO

class CrowdAnalyzer:
    def __init__(self):
        self.model = None
        try:
            # Load YOLO model
            self.model = YOLO("yolov8n.pt")
            print("[INFO] YOLOv8 Model loaded successfully.")
        except Exception as e:
            print(f"[WARN] Failed to load YOLOv8 model: {e}. Will run in simulated mode.")

    def count_people_live(self):
        """
        Attempts to read from system camera (index 0) and use YOLO to count people.
        Falls back to high-fidelity simulation if camera or model is unavailable.
        """
        if self.model is None:
            return self.get_simulated_crowd()

        cap = None
        try:
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                return self.get_simulated_crowd()

            ret, frame = cap.read()
            if not ret:
                cap.release()
                return self.get_simulated_crowd()

            # Perform object detection
            results = self.model(frame, verbose=False)
            people_count = 0
            for r in results:
                for box in r.boxes:
                    cls = int(box.cls[0])
                    if cls == 0:  # Class 0 in COCO is person
                        people_count += 1

            cap.release()
            return people_count

        except Exception as e:
            if cap:
                try:
                    cap.release()
                except:
                    pass
            print(f"[WARN] OpenCV/YOLO live run failed: {e}. Falling back to simulation.")
            return self.get_simulated_crowd()

    def get_simulated_crowd(self):
        """
        Generates highly realistic crowd patterns with natural hourly wave fluctuations,
        small random noise, and updates every call.
        """
        current_time = time.localtime()
        hour = current_time.tm_hour
        minute = current_time.tm_min

        # Generate a wave pattern based on daily peak times:
        # Peak 1: 10:00 - 12:00
        # Peak 2: 15:00 - 18:00
        # Base crowd levels are lower at night
        time_fraction = hour + minute / 60.0
        
        # Double-peak model using sum of sine waves
        base = 15.0  # minimum baseline patients
        peak1 = 20.0 * math.exp(-((time_fraction - 11.0) / 2.0) ** 2)  # morning peak at 11 AM
        peak2 = 25.0 * math.exp(-((time_fraction - 17.0) / 2.5) ** 2)  # evening peak at 5 PM
        night_decay = 0.3 if (hour < 7 or hour > 21) else 1.0
        
        simulated_count = int((base + peak1 + peak2) * night_decay)
        # Add slight random fluctuation (+/- 2 people)
        simulated_count += random.randint(-2, 2)
        
        return max(3, simulated_count)

if __name__ == "__main__":
    analyzer = CrowdAnalyzer()
    print("Testing live crowd detection (or simulation)...")
    for i in range(3):
        print(f"Sample {i+1}: Counted {analyzer.count_people_live()} people")
        time.sleep(1)
