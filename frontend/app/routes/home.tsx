import React from "react";
import type { Route } from "./+types/home";
import type { Prediction } from "~/api";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Prediction Result" }];
}

type Tab = "live" | "database";

type SortKey = "index" | "set_num" | "num_obj" | "num_difference";

type SortDir = "asc" | "desc";

type HistoryItem = Prediction & { __id: string };

export default function Home() {
  const [prediction, setPrediction] = React.useState<Prediction | null>(null);
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [running, setRunning] = React.useState(false);

  const [activeTab, setActiveTab] = React.useState<Tab>("live");
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  const CAMERA_COUNT = 6;
  const cameras = React.useMemo(
    () => Array.from({ length: CAMERA_COUNT }, (_, i) => `Camera ${i + 1}`),
    [CAMERA_COUNT]
  );
  const [selectedCamera, setSelectedCamera] = React.useState<string>(cameras[0] ?? "Camera 1");

  // --- Database sorting state ----------------------------------------------
  const [sortKey, setSortKey] = React.useState<SortKey>("index"); // default: newest first
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  const esRef = React.useRef<EventSource | null>(null);

  // --- Streaming -------------------------------------------------------------
  const start = React.useCallback(() => {
    if (esRef.current) return;
    const url = new URL("http://localhost:8000/stream");
    if (selectedCamera) url.searchParams.set("camera", selectedCamera);

    const es = new EventSource(url.toString());
    es.onmessage = (e) => {
      try {
        const data: Prediction = JSON.parse(e.data);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        const withId: HistoryItem = { ...(data as Prediction), __id: id };
        setPrediction(data);
        setHistory((prev) => [withId, ...prev].slice(0, 500));
        setError(null);
      } catch {
        setError("Bad event payload");
      }
    };
    es.onerror = () => {
      setError("Stream error");
      es.close();
      esRef.current = null;
      setRunning(false);
    };
    esRef.current = es;
    setRunning(true);
  }, [selectedCamera]);

  const stop = React.useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    setRunning(false);
  }, []);

  // Clean up on unmount
  React.useEffect(() => {
    return () => esRef.current?.close();
  }, []);

  // If user switches away from Live, stop the stream
  React.useEffect(() => {
    if (activeTab !== "live" && running) stop();
  }, [activeTab, running, stop]);

  // If camera changes while running, restart quickly on the new camera
  React.useEffect(() => {
    if (!running) return;
    stop();
    const id = setTimeout(() => start(), 0);
    return () => clearTimeout(id);
  }, [selectedCamera]);

  // EXACTLY as before: convert base64 -> data URL for <img>
  const imageSrc = prediction?.img ? `data:image/jpeg;base64,${prediction.img}` : "";
  const diffColor = prediction?.colour ?? "#333";

  // Helpers for DB table
  const toDataUrl = (b64?: string) => (b64 ? `data:image/jpeg;base64,${b64}` : "");
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

  const rows = React.useMemo(
    () =>
      history.map((h, i) => ({
        ...h,
        __index: history.length - i, // 1 = oldest, highest = newest
        __img: toDataUrl(h.img as unknown as string),
      })),
    [history]
  );

  const sortedRows = React.useMemo(() => {
    const copy = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a: any, b: any) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "index":
          av = a.__index;
          bv = b.__index;
          break;
        case "set_num":
          av = num(a.set_num);
          bv = num(b.set_num);
          break;
        case "num_obj":
          av = num(a.num_obj);
          bv = num(b.num_obj);
          break;
        case "num_difference":
          av = num(a.num_difference);
          bv = num(b.num_difference);
          break;
        default:
          av = 0;
          bv = 0;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc"); // change to "asc" if you prefer ascending by default
    }
  };


  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  // --- Styles ---------------------------------------------------------------
  const topBarStyle: React.CSSProperties = {
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    background: "#0b0b0b",
    color: "#eaeaea",
    borderBottom: "1px solid #1f1f1f",
  };

  const tab = (tabKey: Tab, label: string) => (
    <button
      key={tabKey}
      onClick={() => setActiveTab(tabKey)}
      role="tab"
      aria-selected={activeTab === tabKey}
      style={{
        appearance: "none",
        background: "transparent",
        border: "none",
        borderBottom: activeTab === tabKey ? "2px solid #fff" : "2px solid transparent",
        color: activeTab === tabKey ? "#fff" : "#bdbdbd",
        padding: "10px 14px",
        fontSize: "0.95rem",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <main
      style={{
        margin: 0,
        padding: 0,
        height: "100vh",
        width: "100vw",
        display: "grid",
        gridTemplateRows: "56px 1fr",
        background: "#0e0e0e",
        overflow: "hidden", // no page scroll
      }}
    >
      {/* Top Bar with Tabs & Sidebar Toggle */}
      <header style={topBarStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            onClick={() => setSidebarOpen((s) => !s)}
            style={{
              appearance: "none",
              background: "#151515",
              border: "1px solid #2a2a2a",
              color: "#eaeaea",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            {sidebarOpen ? "⟨" : "☰"}
          </button>
          <div style={{ fontWeight: 700, letterSpacing: 0.3, marginLeft: 4 }}>VISION DASH</div>
        </div>
        <nav role="tablist" aria-label="View Tabs" style={{ display: "flex", gap: 4 }}>
          {tab("live", "Live View")}
          {tab("database", "Database")}
        </nav>
      </header>

      {/* Body: Sidebar + Content */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: sidebarOpen ? "240px 1fr" : "0px 1fr",
          height: "100%",
          width: "100%",
          overflow: "hidden",
          transition: "grid-template-columns 160ms ease",
        }}
      >
        {/* Sidebar for Camera Selection (retractable) */}
        <aside
          aria-hidden={!sidebarOpen}
          style={{
            borderRight: sidebarOpen ? "1px solid #1f1f1f" : "none",
            background: "#121212",
            color: "#e6e6e6",
            padding: sidebarOpen ? 16 : 0,
            display: "flex",
            pointerEvents: sidebarOpen ? "auto" : "none",
            opacity: sidebarOpen ? 1 : 0,
            flexDirection: "column",
            gap: 10,
            overflow: "hidden",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Cameras</div>
          <div style={{ display: "grid", gap: 6 }}>
            {cameras.map((cam) => (
              <button
                key={cam}
                onClick={() => setSelectedCamera(cam)}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: selectedCamera === cam ? "1px solid #eaeaea" : "1px solid #2a2a2a",
                  background: selectedCamera === cam ? "#ffffff" : "#191919",
                  color: selectedCamera === cam ? "#000" : "#d9d9d9",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                }}
              >
                {cam}
              </button>
            ))}
          </div>

          
        </aside>

        {/* Content Area */}
        <section style={{ height: "100%", width: "100%", overflow: "hidden" }}>
          {activeTab === "live" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr",
                height: "100%",
                width: "100%",
                overflow: "hidden",
              }}
            >
              {/* Image panel: fill page, no scroll */}
              <div
                style={{
                  background: "#111",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  height: "100%",
                }}
              >
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt="Prediction"
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                  />
                ) : (
                  <div style={{ color: "#aaa", fontSize: "1.25rem", textAlign: "center", padding: 24 }}>
                    {running ? "Waiting for image…" : "Paused"}
                  </div>
                )}
              </div>

              {/* Readout panel */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 20,
                  padding: 24,
                  fontSize: "2rem",
                  lineHeight: 1.2,
                  overflow: "hidden",
                }}
              >
                {prediction && (
                  <section style={{ display: "grid", gap: 10 }}>
                    <div>
                      <strong>TARGET:</strong> {prediction.set_num}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <strong>ACTUAL:</strong>
                      <span style={{ fontSize: "3.5rem" }}>{prediction.num_obj}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <strong>GAP:</strong>
                      <span style={{ color: diffColor, fontSize: "3.5rem", lineHeight: 1 }}>{prediction.num_difference}</span>
                    </div>
                  </section>
                )}

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {!running ? (
                    <button
                      onClick={start}
                      disabled={activeTab !== "live"}
                      style={{
                        color: "#000000ff",
                        fontSize: "1.1rem",
                        padding: "10px 16px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        background: activeTab === "live" ? "#fff" : "#bdbdbd",
                        cursor: activeTab === "live" ? "pointer" : "not-allowed",
                      }}
                    >
                      Start
                    </button>
                  ) : (
                    <button
                      onClick={stop}
                      style={{ color: "#000000ff", fontSize: "1.1rem", padding: "10px 16px", borderRadius: 10, border: "1px solid #ddd", background: "#fff" }}
                    >
                      Stop
                    </button>
                  )}
                  {error && <span style={{ color: "crimson", fontSize: "1rem", alignSelf: "center" }}>{error}</span>}
                </div>
              </div>
            </div>
          ) : (
            // --- Database tab ---
            <div style={{ height: "100%", width: "100%", padding: 16, color: "#eaeaea", overflow: "hidden" }}>
              <h2 style={{ margin: "0 0 8px 0" }}>Database</h2>
              <div
                style={{
                  height: "calc(100% - 40px)",
                  width: "100%",
                  overflow: "auto",
                  border: "1px solid #262626",
                  borderRadius: 12,
                  background: "#121212",
                }}
              >
                {sortedRows.length === 0 ? (
                  <div style={{ padding: 16, color: "#9a9a9a" }}>No records yet.</div>
                ) : (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "separate",
                      borderSpacing: 0,
                      fontSize: "0.95rem",
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            position: "sticky",
                            top: 0,
                            background: "#181818",
                            textAlign: "left",
                            padding: "10px 12px",
                            borderBottom: "1px solid #262626",
                            zIndex: 1,
                            width: 120,
                          }}
                        >
                          Image
                        </th>
                        <SortableTH label="#" onClick={() => onSort("index")} active={sortKey === "index"} dir={sortDir} />
                        <SortableTH label="Target" onClick={() => onSort("set_num")} active={sortKey === "set_num"} dir={sortDir} />
                        <SortableTH label="Actual" onClick={() => onSort("num_obj")} active={sortKey === "num_obj"} dir={sortDir} />
                        <SortableTH label="Gap" onClick={() => onSort("num_difference")} active={sortKey === "num_difference"} dir={sortDir} />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((h) => (
                        <tr key={h.__id} style={{ borderBottom: "1px solid #1e1e1e" }}>
                          <td style={{ padding: 8, borderBottom: "1px solid #1e1e1e" }}>
                            {h.__img ? (
                              <img
                                src={h.__img}
                                alt={`Record ${h.__index}`}
                                style={{ width: 120, height: 80, objectFit: "contain", display: "block", borderRadius: 8, background: "#0f0f0f" }}
                              />)
                            : (
                              <div style={{ width: 120, height: 80, display: "grid", placeItems: "center", background: "#0f0f0f", borderRadius: 8, color: "#777" }}>
                                No image
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid #1e1e1e", color: "#bdbdbd" }}>{h.__index}</td>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid #1e1e1e" }}>{h.set_num}</td>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid #1e1e1e" }}>{h.num_obj}</td>
                          <td style={{ padding: "10px 12px", borderBottom: "1px solid #1e1e1e", color: h.colour ?? "#eaeaea" }}>{h.num_difference}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      {/* Persistent selected camera display */}
      <div
        style={{
          position: "fixed",
          left: 12,
          bottom: 12,
          zIndex: 1000,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 999,
          background: "#141414",
          color: "#eaeaea",
          border: "1px solid #2a2a2a",
          boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
          pointerEvents: "none",
        }}
      >
        <span style={{ opacity: 0.75 }}>Selected:</span>
        <strong style={{ marginLeft: 4 }}>{selectedCamera}</strong>
      </div>
    </main>
  );
}

// Small helper component for sortable header cells
function SortableTH({ label, onClick, active, dir }: { label: string; onClick: () => void; active?: boolean; dir?: SortDir }) {
  return (
    <th
      onClick={onClick}
      role="button"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      style={{
        position: "sticky",
        top: 0,
        background: "#181818",
        textAlign: "left",
        padding: "10px 12px",
        borderBottom: "1px solid #262626",
        cursor: "pointer",
        userSelect: "none",
        color: active ? "#fff" : "#bdbdbd",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {active ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}
