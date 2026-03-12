import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ImageDetection from "./pages/ImageDetection";
import VideoDetection from "./pages/VideoDetection";
import LiveDetection from "./pages/LiveDetection";
import WebcamDetection from "./pages/WebcamDetection";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/image" element={<ImageDetection />} />
        <Route path="/video" element={<VideoDetection />} />
        <Route path="/live" element={<LiveDetection />} />
        <Route path="/webcam" element={<WebcamDetection />} />
      </Routes>
    </BrowserRouter>
  );
}