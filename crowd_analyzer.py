import cv2
import time
import math
import random

class CrowdAnalyzer:
    def __init__(self):
        self.model = None
        print("[INFO] Crowd Analyzer initialized (YOLO will load on demand).")

    # 🔥 LAZY LOAD YOLO MODEL (IMPORTANT FIX FOR RENDER)
    def get_model(self):
        if self.model is None:
            try:
                from ultralytics import YOLO
                self.model = YOLO("yolov8n.pt")
                print("[INFO] YOLOv8 Model loaded successfully.")
            except Exception as e:
                print(f"[WARN] YOLO load failed: {e}. Using simulation mode.")
                self.model = False  # mark as unavailable
        return self.model

    def count_people_live(self):
        """
        Try YOLO detection from camera.
        If not possible → fallback simulation.
        """

        model = self.get_model()

        # ❌ If YOLO failed to load
        if model is False:
            return self.get_simulated_crowd()

        # ❌ If model not available, fallback
        if model is None:
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

            results = model(frame, verbose=False)

            people_count = 0
            for r in results:
                for box in r.boxes:
                    cls = int(box.cls[0])
                    if cls == 0:  # person class
                        people_count += 1

            cap.release()
            return people_count

        except Exception as e:
            print(f"[WARN] Detection failed: {e}")
            if cap:
                try:
                    cap.release()
                except:
                    pass
            return self.get_simulated_crowd()

    def get_simulated_crowd(self):
        """
        Smart hospital crowd simulation (fallback mode)
        """

        current_time = time.localtime()
        hour = current_time.tm_hour
        minute = current_time.tm_min

        time_fraction = hour + minute / 60.0

        base = 15.0
        peak1 = 20.0 * math.exp(-((time_fraction - 11.0) / 2.0) ** 2)
        peak2 = 25.0 * math.exp(-((time_fraction - 17.0) / 2.5) ** 2)

        night_decay = 0.3 if (hour < 7 or hour > 21) else 1.0

        simulated_count = int((base + peak1 + peak2) * night_decay)
        simulated_count += random.randint(-2, 2)

        return max(3, simulated_count)


# ---------------- TEST ----------------
if __name__ == "__main__":
    analyzer = CrowdAnalyzer()
    print("Testing crowd detection...")
    for i in range(3):
        print(f"Sample {i+1}: {analyzer.count_people_live()} people")
        time.sleep(1)