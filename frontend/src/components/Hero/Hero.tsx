import "./Hero.css";
import { useNavigate } from "react-router-dom";

function Hero() {
  const navigate = useNavigate();

  return (
    <section className="hero">
      <div className="hero-content">

        <div className="hero-brand">
          <span className="hero-rocket">🚀</span>

          <h1>AgentVerse AI</h1>
        </div>

        <h2>One Platform. Infinite AI Agents.</h2>

        <p>
          Build, manage and collaborate with intelligent AI agents
          through one unified platform.
        </p>

        <div className="hero-buttons">
          <button
            className="primary-btn"
            onClick={() => navigate("/agents")}
          >
            Get Started
          </button>

          <button
            className="secondary-btn"
            onClick={() => navigate("/agents")}
          >
            Explore Agents
          </button>
        </div>

      </div>
    </section>
  );
}

export default Hero;