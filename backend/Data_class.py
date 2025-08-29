from pydantic import BaseModel

class Data(BaseModel):
    set_num: int
    num_obj: int
    num_difference: int
    colour: str
    img: str  # base64 JPEG bytes (no data: prefix)