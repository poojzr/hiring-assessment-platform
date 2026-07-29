import cv2
import numpy as np
from typing import Dict, Any
import os
import torch

try:
    from ultralytics import YOLO
    HAS_YOLO = True
except ImportError:
    HAS_YOLO = False
    print("YOLO not available. Please install: pip install ultralytics")

MODEL_PATH = "yolov8n.pt"

PHONE_CONFIDENCE_THRESHOLD = 0.35

MIN_BOX_AREA_FRACTION = 0.003
MAX_BOX_AREA_FRACTION = 0.75

class YOLOMobileDetector:
    def __init__(self, model_path: str = MODEL_PATH):
        self.model_path = model_path
        self.model = None
        self._load_model()

    def _load_model(self):
        if not HAS_YOLO:
            print("YOLO not available")
            return

        try:
            if not os.path.exists(self.model_path):
                print(f"YOLO model not found at {self.model_path}. Downloading...")
                from ultralytics import YOLO as YOLOModel
                YOLOModel('yolov8n.pt')

            self.model = YOLO(self.model_path)
            print("YOLO model loaded successfully")
        except Exception as e:
            print(f"Failed to load YOLO model: {e}")
            self.model = None

    def detect(self, frame_data: bytes) -> Dict[str, Any]:
        if self.model is None:
            return {"detected": False, "confidence": 0.0, "error": "Model not loaded"}

        try:
            nparr = np.frombuffer(frame_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return {"detected": False, "confidence": 0.0, "error": "Failed to decode image"}

            frame_area = img.shape[0] * img.shape[1]
            results = self.model(img, verbose=False)

            phone_detected = False
            max_confidence = 0.0
            boxes = []

            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        class_id = int(box.cls[0])
                        if class_id != 67:
                            continue

                        confidence = float(box.conf[0])

                        x1, y1, x2, y2 = (
                            float(box.xyxy[0][0]), float(box.xyxy[0][1]),
                            float(box.xyxy[0][2]), float(box.xyxy[0][3])
                        )
                        box_area = (x2 - x1) * (y2 - y1)
                        area_fraction = box_area / frame_area if frame_area else 0

                        print(f"[YOLOMobileDetector] phone candidate confidence={confidence:.3f} area_fraction={area_fraction:.3f}")

                        if confidence <= PHONE_CONFIDENCE_THRESHOLD:
                            continue

                        if not (MIN_BOX_AREA_FRACTION <= area_fraction <= MAX_BOX_AREA_FRACTION):
                            continue

                        phone_detected = True
                        max_confidence = max(max_confidence, confidence)
                        boxes.append({
                            "x": x1, "y": y1,
                            "width": x2 - x1, "height": y2 - y1,
                            "confidence": confidence
                        })

            return {
                "detected": phone_detected,
                "confidence": max_confidence,
                "boxes": boxes,
                "method": "yolo"
            }

        except Exception as e:
            return {"detected": False, "confidence": 0.0, "error": str(e)}

yolo_detector = YOLOMobileDetector()

def detect_mobile_yolo(frame_data: bytes) -> Dict[str, Any]:
    return yolo_detector.detect(frame_data)