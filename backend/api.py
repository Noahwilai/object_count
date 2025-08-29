from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import asyncio
from Data_class import Data


def ensure_ascii(b64):
    return b64.decode("ascii") if isinstance(b64, (bytes, bytearray)) else str(b64)

def send_api(data_in):
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/stream")
    async def stream():
        async def gen():
            try:
                while True:
                    import inspect
                    d: Data = await asyncio.to_thread(data_in)
                    payload_json = getattr(d, "model_dump_json", d.json)()
                    yield f"data: {payload_json}\n\n"
            except asyncio.CancelledError:
                return

        headers = {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
        return StreamingResponse(gen(), media_type="text/event-stream", headers=headers)

    return app
