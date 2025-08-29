import os
import cv2
import numpy as np
from ultralytics import YOLO

model = YOLO('cheesestick_v3.pt')

def run_model(picture):
    # Run inference
    results = model(picture, agnostic_nms=False, conf=0.7, iou=0.8, device='cuda')
    r = results[0]

    # Extract class IDs and bounding boxes
    class_ids = r.boxes.cls.cpu().numpy().astype(int)
    boxes = r.boxes.xyxy.cpu().numpy()  # [x1, y1, x2, y2]

    # Count detections per class
    counts = len(class_ids)

    # img = picture
    img = picture

    # Combine data for sorting
    data = list(zip(boxes, class_ids))

    # Sort by x (left to right), then y (top to bottom)
    data.sort(key=lambda x: ((x[0][0]+x[0][2]) * 0.5, (x[0][1]+x[0][3]) * 0.5))

    # Draw numbered boxes + numbers
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.7
    thickness = 2
    pad = 6

    for idx, (box, cls_id) in enumerate(data, start=1):
        x1, y1, x2, y2 = map(int, box)
        # Draw rectangle
        cv2.rectangle(img, (x1, y1), (x2, y2), color=(255, 0, 0), thickness=2)

        # Draw index label at top-left inside the box
        label = str(idx)
        (tw, th), _ = cv2.getTextSize(label, font, font_scale, thickness)

        # Label background (for readability)
        bg_x1, bg_y1 = x1, y1
        bg_x2, bg_y2 = x1 + tw + 2 * pad, y1 + th + 2 * pad
        cv2.rectangle(img, (bg_x1, bg_y1), (bg_x2, bg_y2), color=(255, 0, 0), thickness=-1)

        # Label text
        text_org = (x1 + pad, y1 + th + pad)  # inside the box
        cv2.putText(img, label, text_org, font, font_scale, (255, 255, 255), thickness, cv2.LINE_AA)

    return counts, img
