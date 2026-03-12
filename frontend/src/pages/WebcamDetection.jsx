import React, { useState, useRef } from "react";

const WebcamDetection = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const alarmRef = useRef(null);
  const imgRef = useRef(null);

  const handleStart = () => {
    setIsStreaming(true);
    // Alarm triggers automatically via detection logic
  };

  const handleStop = () => {
    setIsStreaming(false);
    if (alarmRef.current) alarmRef.current.pause();
  };

  // Dummy demo logic for triggering alarm: change this with real confidence data in future
  const handleImageLoad = () => {
    // Simulate detection confidence check (TODO: integrate with real backend JSON detection)
    const random = Math.random();
    if (random > 0.7 && alarmRef.current) {
      alarmRef.current.play();
    }
  };

  return (
    <div className="container" style={{ textAlign: "center", paddingTop: "20px" }}>
      <h2>🛡️ Live Weapon Detection from Webcam</h2>
      <div style={{ marginTop: "20px" }}>
        {!isStreaming && (
          <button onClick={handleStart} style={{ padding: "10px 20px", marginRight: "10px" }}>
            Start Detection
          </button>
        )}
        {isStreaming && (
          <button onClick={handleStop} style={{ padding: "10px 20px", backgroundColor: "red", color: "white" }}>
            Stop Detection
          </button>
        )}
      </div>

      {isStreaming && (
        <div style={{ marginTop: "20px" }}>
          <img
            ref={imgRef}
            src="http://localhost:8004/api/camera"
            alt="Live Detection"
            onLoad={handleImageLoad}
            style={{ border: "4px solid black", maxWidth: "90%", height: "auto" }}
          />
        </div>
      )}

      <audio ref={alarmRef} src="/alarm.mp3" preload="auto" />
    </div>
  );
};
export default WebcamDetection;