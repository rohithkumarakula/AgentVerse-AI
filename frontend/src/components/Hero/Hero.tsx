import "./Hero.css";

function Hero() {
  return (
    <section className="hero">
      <div className="hero-content">
        <h1>🚀 AgentVerse AI</h1>

        <h2>One Platform. Infinite AI Agents.</h2>

        <p>
          Build, manage and collaborate with intelligent AI agents
          through one unified platform.
        </p>

        <div className="hero-buttons">
          <button className="primary-btn">
            Get Started
          </button>

          <button className="secondary-btn">
            Explore Agents
          </button>
        </div>
      </div>
    </section>
  );
}

export default Hero;