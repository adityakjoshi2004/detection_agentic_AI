import React from "react";
import { Link } from "react-router-dom";
import "./home.css"; // We'll create this file

export default function Home() {
  return (
    <div className="home-container">
      <div className="overlay" />
      <div className="home-content">
        <h1 className="company-name">AK Security</h1>
        <p className="tagline">Test our services</p>

        <div className="button-group">
          <Link to="/image" className="home-button blue">
            🔍 Image Detection
          </Link>
          <Link to="/video" className="home-button green">
            🎥 Video Detection
          </Link>
          <Link to="/live" className="home-button red">
            📡 Live Detection
          </Link>
          <Link to="/webcam" className="home-button red">
            📡 webcam Detection
          </Link>
        </div>
      </div>

      <footer className="footer">
        © {new Date().getFullYear()} AK Security. All rights reserved.
      </footer>
    </div>
  );
}