export type Prediction = {
  set_num: number;
  num_obj: number;
  num_difference: number;
  colour: string;
  img: string;          // base64 image (no data: prefix)
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

/** Open SSE stream and receive continuous Prediction updates. */
export function openPredictionStream(
  onMessage: (p: Prediction) => void,
  onError?: (err: unknown) => void
): () => void {
  const es = new EventSource(`${API_BASE}/stream`);

  es.onmessage = (ev) => {
    try {
      onMessage(JSON.parse(ev.data) as Prediction);
    } catch (e) {
      console.error("Bad SSE payload", e);
    }
  };

  es.onerror = () => {
    es.close();
    onError?.(new Error("SSE connection lost"));
  };

  return () => es.close();
}
