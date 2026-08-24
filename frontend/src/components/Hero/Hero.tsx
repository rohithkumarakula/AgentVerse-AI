import "./Hero.css";
import { useNavigate } from "react-router-dom";

function Hero() {
  const navigate = useNavigate();

  return (
    <section className="hero">

      {/* Background */}
      <div className="hero-grid" />

      <div className="hero-glow hero-glow-left" />
      <div className="hero-glow hero-glow-right" />

      {/* Hero Content */}
      <div className="hero-content">

        <h1 className="hero-title">

          <span className="hero-line hero-line-white">
            One Platform
          </span>

          <span className="hero-line hero-line-gradient">
            Infinite AI Agents
          </span>

        </h1>

        <p className="hero-description">
          Build, manage and collaborate with intelligent AI
          agents through one unified platform.
        </p>

        <div className="hero-buttons">

          <button
            type="button"
            className="hero-primary-btn"
            onClick={() => navigate("/agents")}
          >
            Explore Agents
          </button>

          <button
            type="button"
            className="hero-primary-btn"
            onClick={() => navigate("/features")}
          >
            View Features
          </button>

        </div>

      </div>

      {/* Scroll to Agents */}
      <a
        href="#agents-section"
        className="hero-scroll-button"
        aria-label="Scroll to AI Agents"
      >
        <span>↓</span>
      </a>

    </section>
  );
}

export default Hero;