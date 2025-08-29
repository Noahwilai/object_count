import base64
import cv2
import uvicorn
import torch

from model import run_model  # returns: (num_obj: int|np.integer, imgin: np.ndarray)
from Data_class import Data
from api import send_api

cap = cv2.VideoCapture("72496908-354c-469b-a90d-5ce177c8aae3.mp4")
print("CUDA Available:", torch.cuda.is_available())

def get_data(image):
    target_num = 1

    # Run model
    num_obj, imgin = run_model(image)

    num_difference = num_obj - target_num

    # Encode image as JPEG -> base64 (unchanged behavior)
    ok, buf = cv2.imencode(".jpg", imgin)
    if not ok:
        raise RuntimeError("Failed to JPEG-encode model output image.")
    img_b64 = base64.b64encode(buf.tobytes()).decode("ascii")

    # Colour logic
    colour = "#ff0000ff"
    if num_difference == 0:
        colour = "#00ff00ff"
    elif num_difference > 0:
        colour = "#ffe000ff"
    return Data(
        set_num=target_num,
        num_obj=num_obj,
        num_difference=num_difference,
        colour=colour,
        img=img_b64,
    )

def get_video():
    ret, frame = cap.read()
    if ret:
        return get_data(frame)
    else:
        raise StopIteration("end of video")

# Main
app = send_api(get_video)
# app = send_api(lambda: get_data(cv2.imread("S__43491364_0.jpg")))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)