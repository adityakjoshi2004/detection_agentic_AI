import React, { useState } from 'react';
import axios from 'axios';

export default function LiveDetection() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    streamUrl: '',
  });
  const [detecting, setDetecting] = useState(false);
  const [videoPath, setVideoPath] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

 const startDetection = async () => {
  if (!form.email || !form.streamUrl) {
    alert("Please fill in both email and stream URL.");
    return;
  }
  setLoading(true);
  try {
    await axios.post(
      `${process.env.REACT_APP_BACKEND_URL}/api/start`,
      null,
      {
        params: {
          stream_url: form.streamUrl
        }
      }
    );
    setDetecting(true);
    setVideoPath(null);
  } catch (error) {
    alert("Failed to start live detection.");
    console.error(error);
  } finally {
    setLoading(false);
  }
};

const stopDetection = async () => {
  setLoading(true);
  try {
    const res = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/stop`);
    if (res.data.video_saved) {
      setVideoPath(`${process.env.REACT_APP_BACKEND_URL}${res.data.video_saved}`);
    }
    setDetecting(false);
  } catch (error) {
    alert("Failed to stop live detection.");
    console.error(error);
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">📡 Live Weapon Detection</h2>

      <div className="space-y-4">
        <input
          type="text"
          name="name"
          placeholder="Your Name"
          value={form.name}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded"
        />
        <input
          type="email"
          name="email"
          placeholder="Your Email"
          value={form.email}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded"
        />
        <input
          type="text"
          name="streamUrl"
          placeholder="Camera Stream URL (e.g. http://192.168.x.x:8080/video)"
          value={form.streamUrl}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded"
        />

        {!detecting ? (
          <button
            onClick={startDetection}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {loading ? "Starting..." : "Start Detection"}
          </button>
        ) : (
          <button
            onClick={stopDetection}
            className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            {loading ? "Stopping..." : "Stop Detection"}
          </button>
        )}
      </div>

      {videoPath && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-2">🎥 Detection Result</h3>
          <video src={videoPath} controls className="w-full rounded shadow-lg"></video>
          <a href={videoPath} download className="block mt-4 text-blue-600 underline">
            Download Result Video
          </a>
        </div>
      )}
    </div>
  );
}
