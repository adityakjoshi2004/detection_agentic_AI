import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { analyzeWithStream } from '../services/api';

/* ── colour tokens ── */
const C = {
  bg: '#0a0e1a',
  surface: '#1a1f2e',
  surface2: '#232839',
  border: '#2a3042',
  accent: '#e74c3c',
  cyan: '#00d4ff',
  green: '#00e676',
  orange: '#ff9800',
  text: '#e0e6ed',
  muted: '#8892a4',
  json: '#00ff88',
};

/* ── reusable inline styles ── */
const sCard = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 20,
};

export default function ImageDetection() {
  const [file, setFile] = useState(null);
  const [original, setOriginal] = useState(null);
  const [resized, setResized] = useState(null);
  const [gray, setGray] = useState(null);
  const [blurred, setBlurred] = useState(null);
  const [edges, setEdges] = useState(null);
  const [annotated, setAnnotated] = useState(null);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("Awaiting input…");
  const [predictionData, setPredictionData] = useState(null);
  const [agentInput, setAgentInput] = useState(null);
  const [securityReport, setSecurityReport] = useState(null);
  const [clock, setClock] = useState(new Date());
  const [dragOver, setDragOver] = useState(false);

  /* ── Chain-of-Thought state ── */
  const [agentEvents, setAgentEvents] = useState([]);
  const [agentFlowStatus, setAgentFlowStatus] = useState({
    detection: 'waiting',
    risk: 'waiting',
    sop: 'waiting',
    notify: 'waiting',
  });
  const [agentTimings, setAgentTimings] = useState({});
  const [showOrchestration, setShowOrchestration] = useState(false);
  const logEndRef = useRef(null);

  /* live clock */
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* auto-scroll agent log */
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [agentEvents]);

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  /* ── file handling ── */
  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setOriginal(URL.createObjectURL(selected));
    setResized(null); setGray(null); setBlurred(null);
    setEdges(null); setAnnotated(null);
    setPredictionData(null); setAgentInput(null); setSecurityReport(null);
    setAgentEvents([]); setShowOrchestration(false); setAgentTimings({});
    setAgentFlowStatus({ detection: 'waiting', risk: 'waiting', sop: 'waiting', notify: 'waiting' });
    setStep(0);
    setStatus("File loaded — ready to scan");
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      setOriginal(URL.createObjectURL(dropped));
      setResized(null); setGray(null); setBlurred(null);
      setEdges(null); setAnnotated(null);
      setPredictionData(null); setAgentInput(null); setSecurityReport(null);
      setAgentEvents([]); setShowOrchestration(false); setAgentTimings({});
      setAgentFlowStatus({ detection: 'waiting', risk: 'waiting', sop: 'waiting', notify: 'waiting' });
      setStep(0);
      setStatus("File loaded — ready to scan");
    }
  };

  /* ── upload & detection pipeline ── */
  const handleUpload = async () => {
    if (!file) return alert("Please select an image first.");
    setStatus("Uploading…"); setStep(1);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post("http://127.0.0.1:8004/api/", formData);

      setStatus("Capturing Original…"); setStep(2);
      await delay(1000);
      setOriginal(`http://127.0.0.1:8004/${res.data.original}`);

      setStatus("Resizing Frame…"); setStep(3);
      await delay(1000);
      setResized(`http://127.0.0.1:8004/${res.data.resized}`);

      setStatus("Grayscale Conversion…"); setStep(4);
      await delay(1000);
      setGray(`http://127.0.0.1:8004/${res.data.gray}`);

      setStatus("Gaussian Blur…"); setStep(5);
      await delay(1000);
      setBlurred(`http://127.0.0.1:8004/${res.data.blurred}`);

      setStatus("Edge Detection…"); setStep(6);
      await delay(1000);
      setEdges(`http://127.0.0.1:8004/${res.data.edges}`);

      setStatus("YOLOv8 Inference…"); setStep(7);
      await delay(1500);
      setAnnotated(`http://127.0.0.1:8004/${res.data.annotated}`);

      if (res.data.prediction_chart) {
        setPredictionData(`http://127.0.0.1:8004/${res.data.prediction_chart}`);
      }

      setStatus("SCAN COMPLETE"); setStep(8);

      // Build JSON input for AI agents
      if (res.data.detections) {
        const weapons = {};
        res.data.detections.forEach(obj => {
          weapons[obj.class] = Math.max(obj.confidence, weapons[obj.class] || 0);
        });

        const agentPayload = {
          weapons_detected: weapons,
          location: "Warehouse Gate 3",
          timestamp: new Date().toISOString(),
          scene_image_b64: res.data.scene_image_b64 || null,
        };
        setAgentInput(agentPayload);

        // Reset Chain-of-Thought state
        setAgentEvents([]);
        setAgentFlowStatus({
          detection: 'done',
          risk: 'waiting',
          sop: 'waiting',
          notify: 'waiting',
        });
        setAgentTimings({});
        setShowOrchestration(true);
        setStatus("AI Agent Orchestration…");

        try {
          const report = await analyzeWithStream(agentPayload, (event) => {
            // Handle each streamed event
            setAgentEvents(prev => [...prev, event]);

            // Update flow status based on event
            if (event.agent === 'risk') {
              if (event.status === 'processing') {
                setAgentFlowStatus(prev => ({ ...prev, risk: 'processing' }));
              } else if (event.status === 'done') {
                setAgentFlowStatus(prev => ({ ...prev, risk: 'done' }));
                if (event.data?.elapsed) setAgentTimings(prev => ({ ...prev, risk: event.data.elapsed }));
              } else if (event.status === 'error') {
                setAgentFlowStatus(prev => ({ ...prev, risk: 'error' }));
              }
            } else if (event.agent === 'sop') {
              if (event.status === 'processing') {
                setAgentFlowStatus(prev => ({ ...prev, sop: 'processing' }));
              } else if (event.status === 'done') {
                setAgentFlowStatus(prev => ({ ...prev, sop: 'done' }));
                if (event.data?.elapsed) setAgentTimings(prev => ({ ...prev, sop: event.data.elapsed }));
              } else if (event.status === 'skipped') {
                setAgentFlowStatus(prev => ({ ...prev, sop: 'skipped' }));
              }
            } else if (event.agent === 'notify') {
              if (event.status === 'processing') {
                setAgentFlowStatus(prev => ({ ...prev, notify: 'processing' }));
              } else if (event.status === 'done') {
                setAgentFlowStatus(prev => ({ ...prev, notify: 'done' }));
                if (event.data?.elapsed) setAgentTimings(prev => ({ ...prev, notify: event.data.elapsed }));
              } else if (event.status === 'skipped') {
                setAgentFlowStatus(prev => ({ ...prev, notify: 'skipped' }));
              }
            }
          });
          setSecurityReport(report);
        } catch (err) {
          console.error("Agent system error:", err);
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      setStatus("SCAN FAILED");
    }
  };

  /* ── pipeline step labels ── */
  const pipelineSteps = ['Upload', 'Original', 'Resize', 'Gray', 'Blur', 'Edge', 'YOLO', 'Done'];

  /* ── risk colour helper ── */
  const riskColor = (level) =>
    level === 'HIGH' ? C.accent : level === 'MEDIUM' ? C.orange : C.green;

  /* ── images array for the grid ── */
  const images = [
    { label: 'ORIGINAL', src: original, accent: false },
    { label: 'RESIZED', src: resized, accent: false },
    { label: 'GRAYSCALE', src: gray, accent: false },
    { label: 'GAUSSIAN BLUR', src: blurred, accent: false },
    { label: 'EDGE MAP', src: edges, accent: false },
    { label: 'THREAT DETECTED', src: annotated, accent: true },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.text,
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      padding: 0,
      margin: 0,
    }}>

      {/* ═══════ HEADER BAR ═══════ */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 32px',
        background: 'linear-gradient(90deg, #0d1224 0%, #151b30 100%)',
        borderBottom: `1px solid ${C.border}`,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 26 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: C.text }}>
              Security Operations Center
            </div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1 }}>
              WEAPON DETECTION SYSTEM • YOLOv8
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* system status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: C.green,
              boxShadow: `0 0 8px ${C.green}`, display: 'inline-block',
              animation: 'pulse 2s infinite',
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.green, letterSpacing: 1 }}>
              SYSTEM ACTIVE
            </span>
          </div>
          {/* clock */}
          <div style={{ fontSize: 13, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
            {clock.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            {' • '}
            {clock.toLocaleTimeString('en-US', { hour12: false })}
          </div>
        </div>
      </header>

      {/* ═══════  MAIN CONTENT  ═══════ */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 32px 60px' }}>

        {/* ── UPLOAD & CONTROL PANEL ── */}
        <div style={{ ...sCard, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ color: C.cyan, fontSize: 18 }}>📡</span>
            <h3 style={{ margin: 0, fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase', color: C.muted }}>
              Image Upload & Scan Control
            </h3>
          </div>

          <div style={{ display: 'flex', gap: 20, alignItems: 'stretch', flexWrap: 'wrap' }}>
            {/* dropzone */}
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                flex: '1 1 340px',
                border: `2px dashed ${dragOver ? C.cyan : C.border}`,
                borderRadius: 10,
                padding: '36px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.2s, background 0.2s',
                background: dragOver ? 'rgba(0,212,255,0.04)' : 'transparent',
              }}
            >
              <input type="file" accept="image/*" onChange={handleFileChange}
                style={{ display: 'none' }} />
              <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {file ? file.name : 'Drop CCTV image or click to browse'}
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                JPG, PNG — any resolution
              </div>
            </label>

            {/* scan button */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
              <button onClick={handleUpload} style={{
                background: `linear-gradient(135deg, ${C.accent}, #c0392b)`,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '14px 36px',
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 1.5,
                cursor: 'pointer',
                textTransform: 'uppercase',
                boxShadow: `0 4px 20px rgba(231,76,60,0.35)`,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                ▶ Initiate Scan
              </button>
              <div style={{
                fontSize: 12,
                color: step === 8 ? C.green : step > 0 ? C.cyan : C.muted,
                fontWeight: 600,
                letterSpacing: 0.5,
                textAlign: 'center',
              }}>
                {status}
              </div>
            </div>
          </div>

          {/* progress bar */}
          <div style={{ marginTop: 18 }}>
            <div style={{
              display: 'flex', gap: 4,
            }}>
              {pipelineSteps.map((lbl, i) => (
                <div key={i} style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  background: i < step ? (i === 7 ? C.green : C.cyan) : C.surface2,
                  transition: 'background 0.4s ease',
                  boxShadow: i < step ? `0 0 6px ${i === 7 ? C.green : C.cyan}40` : 'none',
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {pipelineSteps.map((lbl, i) => (
                <div key={i} style={{
                  flex: 1, textAlign: 'center', fontSize: 9,
                  color: i < step ? C.text : C.muted,
                  letterSpacing: 0.5, textTransform: 'uppercase',
                }}>
                  {lbl}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── IMAGE PROCESSING PIPELINE ── */}
        {original && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ color: C.cyan, fontSize: 18 }}>🔬</span>
              <h3 style={{ margin: 0, fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase', color: C.muted }}>
                Image Processing Pipeline
              </h3>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}>
              {images.map((img, i) => img.src && (
                <div key={i} style={{
                  ...sCard,
                  padding: 0, overflow: 'hidden',
                  border: img.accent
                    ? `2px solid ${C.accent}`
                    : `1px solid ${C.border}`,
                  boxShadow: img.accent ? `0 0 20px ${C.accent}30` : 'none',
                  transition: 'transform 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  {/* label badge */}
                  <div style={{
                    padding: '8px 14px',
                    background: img.accent ? C.accent : C.surface2,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: img.accent ? '#fff' : C.cyan,
                      display: 'inline-block',
                    }} />
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: 1,
                      textTransform: 'uppercase',
                      color: img.accent ? '#fff' : C.text,
                    }}>
                      {img.label}
                    </span>
                  </div>
                  <img src={img.src} alt={img.label} style={{
                    width: '100%', height: 220, objectFit: 'cover',
                    display: 'block',
                  }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── THREAT ANALYSIS ROW ── */}
        {(predictionData || agentInput) && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: predictionData && agentInput ? '1fr 1fr' : '1fr',
            gap: 20, marginBottom: 28,
          }}>
            {/* Prediction chart */}
            {predictionData && (
              <div style={{ ...sCard }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 16 }}>📊</span>
                  <h3 style={{ margin: 0, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: C.muted }}>
                    Prediction Analysis
                  </h3>
                </div>
                <img src={predictionData} alt="Prediction Chart" style={{
                  width: '100%', borderRadius: 8,
                  border: `1px solid ${C.border}`,
                }} />
              </div>
            )}

            {/* Detection JSON */}
            {agentInput && (
              <div style={{ ...sCard }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 16 }}>📦</span>
                  <h3 style={{ margin: 0, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: C.muted }}>
                    Detection Payload
                  </h3>
                </div>
                <pre style={{
                  background: '#0c0f18',
                  color: C.json,
                  padding: 18,
                  borderRadius: 8,
                  fontSize: 13,
                  lineHeight: 1.7,
                  overflowX: 'auto',
                  margin: 0,
                  border: `1px solid ${C.border}`,
                  fontFamily: "'Fira Code', 'Consolas', monospace",
                }}>
                  {JSON.stringify(agentInput, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ══════ AGENT ORCHESTRATION PANEL ══════ */}
        {showOrchestration && (
          <div style={{
            ...sCard,
            padding: 0,
            overflow: 'hidden',
            marginBottom: 28,
            border: `1px solid ${C.cyan}30`,
            boxShadow: `0 0 30px ${C.cyan}10`,
          }}>
            {/* Panel Header */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,230,118,0.08))',
              padding: '14px 24px',
              display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: `1px solid ${C.border}`,
            }}>
              <span style={{ fontSize: 20 }}>🧠</span>
              <h2 style={{
                margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: 2,
                textTransform: 'uppercase', color: C.cyan,
              }}>
                Agent Orchestration — Chain of Thought
              </h2>
              <span style={{
                marginLeft: 'auto',
                fontSize: 11,
                color: C.muted,
                letterSpacing: 1,
                fontFamily: "'Fira Code', monospace",
              }}>
                A2A PROTOCOL • LANGGRAPH
              </span>
            </div>

            <div style={{ padding: 24 }}>
              {/* ── AGENT FLOW DIAGRAM ── */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0,
                marginBottom: 24,
                flexWrap: 'wrap',
              }}>
                {[
                  { key: 'detection', label: 'Detection', icon: '🎯', port: 8004 },
                  { key: 'risk', label: 'Risk Agent', icon: '⚡', port: 8001 },
                  { key: 'sop', label: 'SOP Agent', icon: '📋', port: 8002 },
                  { key: 'notify', label: 'Notify Agent', icon: '🚨', port: 8003 },
                ].map((agent, idx, arr) => {
                  const status = agentFlowStatus[agent.key];
                  const nodeColor =
                    status === 'done' ? C.green :
                    status === 'processing' ? C.cyan :
                    status === 'error' ? C.accent :
                    status === 'skipped' ? C.muted :
                    C.border;
                  const isActive = status === 'processing';
                  const isDone = status === 'done';
                  const isSkipped = status === 'skipped';

                  return (
                    <React.Fragment key={agent.key}>
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                        minWidth: 120,
                      }}>
                        {/* Node circle */}
                        <div style={{
                          width: 64, height: 64,
                          borderRadius: '50%',
                          border: `2px solid ${nodeColor}`,
                          background: isActive
                            ? `radial-gradient(circle, ${nodeColor}20, transparent)`
                            : isDone
                            ? `radial-gradient(circle, ${nodeColor}15, transparent)`
                            : C.surface2,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 24,
                          boxShadow: isActive
                            ? `0 0 20px ${nodeColor}50, 0 0 40px ${nodeColor}20`
                            : isDone
                            ? `0 0 12px ${nodeColor}30`
                            : 'none',
                          animation: isActive ? 'agentPulse 1.5s ease-in-out infinite' : 'none',
                          transition: 'all 0.4s ease',
                          opacity: isSkipped ? 0.4 : 1,
                          position: 'relative',
                        }}>
                          {isDone ? '✅' : isSkipped ? '⏭️' : agent.icon}
                        </div>

                        {/* Agent label */}
                        <div style={{
                          fontSize: 11, fontWeight: 700, letterSpacing: 1,
                          textTransform: 'uppercase',
                          color: isDone ? C.green : isActive ? C.cyan : isSkipped ? C.muted : C.text,
                          textAlign: 'center',
                          transition: 'color 0.3s',
                        }}>
                          {agent.label}
                        </div>

                        {/* Port badge */}
                        <div style={{
                          fontSize: 10, fontFamily: "'Fira Code', monospace",
                          color: C.muted, background: C.surface2,
                          padding: '2px 8px', borderRadius: 10,
                          border: `1px solid ${C.border}`,
                        }}>
                          :{agent.port}
                        </div>

                        {/* Timing */}
                        {agentTimings[agent.key] && (
                          <div style={{
                            fontSize: 10, fontFamily: "'Fira Code', monospace",
                            color: C.green, fontWeight: 700,
                          }}>
                            {agentTimings[agent.key]}s
                          </div>
                        )}
                        {isSkipped && (
                          <div style={{ fontSize: 10, color: C.muted, fontStyle: 'italic' }}>skipped</div>
                        )}
                      </div>

                      {/* Arrow connector */}
                      {idx < arr.length - 1 && (
                        <div style={{
                          display: 'flex', alignItems: 'center',
                          margin: '0 4px', paddingBottom: 40,
                        }}>
                          <div style={{
                            width: 40, height: 2,
                            background: agentFlowStatus[arr[idx + 1].key] !== 'waiting'
                              ? `linear-gradient(90deg, ${C.green}, ${C.cyan})`
                              : C.border,
                            transition: 'background 0.4s',
                            position: 'relative',
                          }}>
                            <div style={{
                              position: 'absolute', right: -6, top: -4,
                              width: 0, height: 0,
                              borderTop: '5px solid transparent',
                              borderBottom: '5px solid transparent',
                              borderLeft: `8px solid ${
                                agentFlowStatus[arr[idx + 1].key] !== 'waiting' ? C.cyan : C.border
                              }`,
                              transition: 'border-color 0.4s',
                            }} />
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* ── LIVE AGENT LOG ── */}
              <div style={{
                background: '#080b14',
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                overflow: 'hidden',
              }}>
                {/* Log header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 16px',
                  background: C.surface2,
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#e74c3c' }} />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f39c12' }} />
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2ecc71' }} />
                  </div>
                  <span style={{
                    fontSize: 11, color: C.muted, letterSpacing: 1,
                    fontFamily: "'Fira Code', monospace",
                  }}>
                    agent-orchestration.log
                  </span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, color: C.muted,
                    fontFamily: "'Fira Code', monospace",
                  }}>
                    {agentEvents.length} events
                  </span>
                </div>

                {/* Log entries */}
                <div style={{
                  maxHeight: 260,
                  overflowY: 'auto',
                  padding: '12px 16px',
                  fontFamily: "'Fira Code', 'Consolas', monospace",
                  fontSize: 12,
                  lineHeight: 1.8,
                }}>
                  {agentEvents.length === 0 && (
                    <div style={{ color: C.muted, fontStyle: 'italic' }}>
                      Waiting for agent events...
                    </div>
                  )}
                  {agentEvents.map((evt, i) => {
                    const agentColors = {
                      orchestrator: C.cyan,
                      risk: C.green,
                      sop: C.orange,
                      notify: C.accent,
                    };
                    const agentLabels = {
                      orchestrator: 'ORCHESTRATOR',
                      risk: 'RISK AGENT   ',
                      sop: 'SOP AGENT    ',
                      notify: 'NOTIFY AGENT ',
                    };
                    const statusIcons = {
                      start: '▶',
                      routing: '→',
                      processing: '⏳',
                      done: '✅',
                      complete: '🏁',
                      error: '❌',
                      skipped: '⏭️',
                    };

                    return (
                      <div key={i} style={{
                        animation: 'fadeInUp 0.3s ease-out',
                        display: 'flex',
                        gap: 8,
                        opacity: evt.status === 'skipped' ? 0.5 : 1,
                      }}>
                        <span style={{ color: C.muted, flexShrink: 0 }}>[{evt.timestamp}]</span>
                        <span style={{ flexShrink: 0 }}>{statusIcons[evt.status] || '•'}</span>
                        <span style={{
                          color: agentColors[evt.agent] || C.text,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}>
                          {agentLabels[evt.agent] || evt.agent.toUpperCase()}
                        </span>
                        <span style={{ color: '#4a5568', flexShrink: 0 }}>│</span>
                        <span style={{
                          color: evt.status === 'error' ? C.accent :
                                 evt.status === 'complete' ? C.green :
                                 evt.status === 'done' ? '#a0d8b0' :
                                 C.text,
                          fontWeight: evt.status === 'complete' ? 700 : 400,
                        }}>
                          {evt.message}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── AI SECURITY INCIDENT REPORT ── */}
        {securityReport && (
          <div style={{
            ...sCard,
            padding: 0,
            overflow: 'hidden',
            border: `1px solid ${C.accent}50`,
            boxShadow: `0 0 30px ${C.accent}15`,
          }}>
            {/* red header */}
            <div style={{
              background: `linear-gradient(135deg, ${C.accent}, #c0392b)`,
              padding: '16px 24px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 22 }}>🚨</span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#fff' }}>
                Incident Report
              </h2>
            </div>

            <div style={{ padding: 24 }}>
              {/* info grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16, marginBottom: 24,
              }}>
                <InfoTile label="Incident ID" value={securityReport.incident_id || '—'} icon="🔖" />
                <InfoTile label="Risk Level" icon="⚠️"
                  value={
                    <span style={{
                      background: riskColor(securityReport.risk_level),
                      color: '#fff', padding: '3px 14px', borderRadius: 20,
                      fontSize: 12, fontWeight: 700, letterSpacing: 1,
                    }}>
                      {securityReport.risk_level || '—'}
                    </span>
                  }
                />
                <InfoTile label="Location" value={securityReport.location || '—'} icon="📍" />
                <InfoTile label="Timestamp" value={securityReport.timestamp || '—'} icon="🕐" />
              </div>

              {/* AI Reasoning */}
              <div style={{
                background: C.surface2,
                borderRadius: 8,
                padding: 18,
                marginBottom: 20,
                borderLeft: `3px solid ${C.cyan}`,
              }}>
                <h4 style={{
                  margin: '0 0 8px', fontSize: 12, letterSpacing: 1.5,
                  textTransform: 'uppercase', color: C.cyan,
                }}>
                  🧠 AI Threat Assessment
                </h4>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: C.text }}>
                  {securityReport.risk_reasoning || 'Awaiting analysis…'}
                </p>
              </div>

              {/* SOP Steps */}
              {securityReport.sop_steps?.length > 0 && (
                <div style={{
                  background: C.surface2,
                  borderRadius: 8,
                  padding: 18,
                  marginBottom: 20,
                  borderLeft: `3px solid ${C.orange}`,
                }}>
                  <h4 style={{
                    margin: '0 0 12px', fontSize: 12, letterSpacing: 1.5,
                    textTransform: 'uppercase', color: C.orange,
                  }}>
                    📋 Standard Operating Procedure
                  </h4>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    {securityReport.sop_steps.map((s, i) => (
                      <li key={i} style={{
                        fontSize: 14,
                        lineHeight: 1.8,
                        color: C.text,
                      }}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* AI Recommended Steps */}
              {securityReport.ai_recommended_steps?.length > 0 && (
                <div style={{
                  background: C.surface2,
                  borderRadius: 8,
                  padding: 18,
                  marginBottom: 20,
                  borderLeft: `3px solid ${C.cyan}`,
                }}>
                  <h4 style={{
                    margin: '0 0 12px', fontSize: 12, letterSpacing: 1.5,
                    textTransform: 'uppercase', color: C.cyan,
                  }}>
                    🤖 AI Recommended Steps (Beyond SOP)
                  </h4>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    {securityReport.ai_recommended_steps.map((s, i) => (
                      <li key={i} style={{
                        fontSize: 14,
                        lineHeight: 1.8,
                        color: C.text,
                      }}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Immediate Actions */}
              {securityReport.immediate_actions?.length > 0 && (
                <div style={{
                  background: 'rgba(231,76,60,0.08)',
                  borderRadius: 8,
                  padding: 18,
                  marginBottom: 20,
                  borderLeft: `3px solid ${C.accent}`,
                }}>
                  <h4 style={{
                    margin: '0 0 12px', fontSize: 12, letterSpacing: 1.5,
                    textTransform: 'uppercase', color: C.accent,
                  }}>
                    ⚡ Immediate Actions (First 60 Seconds)
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {securityReport.immediate_actions.map((a, i) => (
                      <li key={i} style={{
                        fontSize: 14,
                        lineHeight: 1.8,
                        color: C.text,
                        fontWeight: 600,
                      }}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Communication Chain */}
              {securityReport.communication_chain?.length > 0 && (
                <div style={{
                  background: C.surface2,
                  borderRadius: 8,
                  padding: 18,
                  marginBottom: 20,
                  borderLeft: '3px solid #9b59b6',
                }}>
                  <h4 style={{
                    margin: '0 0 12px', fontSize: 12, letterSpacing: 1.5,
                    textTransform: 'uppercase', color: '#9b59b6',
                  }}>
                    📞 Communication Chain
                  </h4>
                  <ol style={{ margin: 0, paddingLeft: 20 }}>
                    {securityReport.communication_chain.map((c, i) => (
                      <li key={i} style={{
                        fontSize: 14,
                        lineHeight: 1.8,
                        color: C.text,
                      }}>{c}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Response Time */}
              {securityReport.estimated_response_time && (
                <div style={{
                  background: C.surface2,
                  borderRadius: 8,
                  padding: '12px 18px',
                  marginBottom: 20,
                  borderLeft: `3px solid ${C.cyan}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 16 }}>⏱️</span>
                  <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                    Est. Response Time:
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.cyan }}>
                    {securityReport.estimated_response_time}
                  </span>
                </div>
              )}

              {/* ── NOTIFICATION SECTION ── */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.05), rgba(0,230,118,0.05))',
                borderRadius: 10,
                padding: 20,
                marginBottom: 20,
                border: `1px solid ${C.border}`,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                }}>
                  <span style={{ fontSize: 20 }}>🚨</span>
                  <h3 style={{
                    margin: 0, fontSize: 14, letterSpacing: 1.5,
                    textTransform: 'uppercase', color: C.green, fontWeight: 700,
                  }}>
                    Notification & Alert System
                  </h3>
                  <span style={{
                    background: C.green,
                    color: '#0a0e1a',
                    padding: '2px 12px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                    marginLeft: 'auto',
                  }}>
                    {securityReport.notification_status || 'PENDING'}
                  </span>
                </div>

                {/* Alert Message */}
                {securityReport.alert_message && (
                  <div style={{
                    background: 'rgba(231,76,60,0.1)',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                    border: `1px solid ${C.accent}40`,
                  }}>
                    <h4 style={{
                      margin: '0 0 8px', fontSize: 11, letterSpacing: 1.5,
                      textTransform: 'uppercase', color: C.accent,
                    }}>
                      📢 Broadcast Alert Message
                    </h4>
                    <p style={{
                      margin: 0, fontSize: 14, lineHeight: 1.7,
                      color: C.text, fontWeight: 500,
                    }}>
                      {securityReport.alert_message}
                    </p>
                  </div>
                )}

                {/* Emergency Helplines */}
                {securityReport.emergency_helplines?.length > 0 && (
                  <div style={{
                    background: C.surface2,
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                  }}>
                    <h4 style={{
                      margin: '0 0 12px', fontSize: 11, letterSpacing: 1.5,
                      textTransform: 'uppercase', color: C.accent,
                    }}>
                      🆘 Emergency Helplines
                    </h4>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                      gap: 10,
                    }}>
                      {securityReport.emergency_helplines.map((h, i) => (
                        <div key={i} style={{
                          background: C.surface,
                          borderRadius: 8,
                          padding: '12px 14px',
                          border: `1px solid ${C.border}`,
                          display: 'flex', flexDirection: 'column', gap: 4,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                              {h.name}
                            </span>
                            <span style={{
                              fontSize: 16, fontWeight: 800, color: C.accent,
                              fontFamily: "'Fira Code', monospace",
                            }}>
                              {h.number}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
                            {h.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SMS Messages */}
                {securityReport.sms_messages && Object.keys(securityReport.sms_messages).length > 0 && (
                  <div style={{
                    background: C.surface2,
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                  }}>
                    <h4 style={{
                      margin: '0 0 12px', fontSize: 11, letterSpacing: 1.5,
                      textTransform: 'uppercase', color: C.orange,
                    }}>
                      💬 Ready-to-Send SMS / WhatsApp Messages
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {Object.entries(securityReport.sms_messages).map(([recipient, msg], i) => (
                        <div key={i} style={{
                          background: C.surface,
                          borderRadius: 8,
                          padding: '12px 14px',
                          border: `1px solid ${C.border}`,
                        }}>
                          <div style={{
                            fontSize: 11, fontWeight: 700, color: C.orange,
                            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
                          }}>
                            📱 {recipient.replace(/_/g, ' ')}
                          </div>
                          <div style={{
                            fontSize: 13, color: C.text, lineHeight: 1.6,
                            fontStyle: 'italic',
                          }}>
                            "{msg}"
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notification Priority */}
                {securityReport.notification_priority?.length > 0 && (
                  <div style={{
                    background: C.surface2,
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                  }}>
                    <h4 style={{
                      margin: '0 0 12px', fontSize: 11, letterSpacing: 1.5,
                      textTransform: 'uppercase', color: '#3498db',
                    }}>
                      📋 Notification Priority Order
                    </h4>
                    <ol style={{ margin: 0, paddingLeft: 20 }}>
                      {securityReport.notification_priority.map((p, i) => (
                        <li key={i} style={{
                          fontSize: 13, lineHeight: 1.8, color: C.text,
                        }}>{p}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Escalation Triggers */}
                {securityReport.escalation_triggers?.length > 0 && (
                  <div style={{
                    background: C.surface2,
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 16,
                  }}>
                    <h4 style={{
                      margin: '0 0 12px', fontSize: 11, letterSpacing: 1.5,
                      textTransform: 'uppercase', color: '#e67e22',
                    }}>
                      🔺 Escalation Triggers
                    </h4>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {securityReport.escalation_triggers.map((t, i) => (
                        <li key={i} style={{
                          fontSize: 13, lineHeight: 1.8, color: C.text,
                        }}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* All-Clear Message */}
                {securityReport.all_clear_message && (
                  <div style={{
                    background: 'rgba(0,230,118,0.08)',
                    borderRadius: 8,
                    padding: 16,
                    border: `1px solid ${C.green}30`,
                  }}>
                    <h4 style={{
                      margin: '0 0 8px', fontSize: 11, letterSpacing: 1.5,
                      textTransform: 'uppercase', color: C.green,
                    }}>
                      ✅ All-Clear Message (Draft)
                    </h4>
                    <p style={{
                      margin: 0, fontSize: 13, lineHeight: 1.7,
                      color: C.text, fontStyle: 'italic',
                    }}>
                      "{securityReport.all_clear_message}"
                    </p>
                  </div>
                )}
              </div>

              {/* AI Notes */}
              {securityReport.ai_notes && (
                <div style={{
                  background: C.surface2,
                  borderRadius: 8,
                  padding: '12px 18px',
                  borderLeft: `3px solid ${C.muted}`,
                }}>
                  <h4 style={{
                    margin: '0 0 6px', fontSize: 11, letterSpacing: 1.5,
                    textTransform: 'uppercase', color: C.muted,
                  }}>
                    💡 AI Notes
                  </h4>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: C.muted }}>
                    {securityReport.ai_notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ═══════ GLOBAL STYLES (keyframes) ═══════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: ${C.bg}; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes agentPulse {
          0%, 100% { box-shadow: 0 0 8px ${C.cyan}40, 0 0 20px ${C.cyan}15; }
          50% { box-shadow: 0 0 20px ${C.cyan}70, 0 0 40px ${C.cyan}30; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${C.bg}; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
      `}</style>
    </div>
  );
}

/* ── Small info tile for the report grid ── */
const InfoTile = ({ label, value, icon }) => (
  <div style={{
    background: C.surface2,
    borderRadius: 8,
    padding: '14px 16px',
    border: `1px solid ${C.border}`,
  }}>
    <div style={{
      fontSize: 11, color: C.muted, letterSpacing: 1,
      textTransform: 'uppercase', marginBottom: 6,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span>{icon}</span> {label}
    </div>
    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
      {value}
    </div>
  </div>
);
