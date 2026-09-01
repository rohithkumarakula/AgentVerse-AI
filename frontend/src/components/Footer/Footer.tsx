import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <h3>AgentVerse AI</h3>

      <p>
        Build, manage and collaborate with intelligent AI agents.
      </p>

      <p className="footer-built-by">
        Built by <strong>AKULA ROHITH KUMAR</strong>
      </p>

      <div className="footer-links">
        <a href="https://github.com/rohithkumarakula" target="_blank" rel="noopener noreferrer" aria-label="AKULA ROHITH KUMAR on GitHub">
          GitHub
        </a>
        <a href="https://www.linkedin.com/in/rohithkumarakula/" target="_blank" rel="noopener noreferrer" aria-label="AKULA ROHITH KUMAR on LinkedIn">
          LinkedIn
        </a>
      </div>

      <small>
        © 2026 AgentVerse AI. All rights reserved.
      </small>
    </footer>
  );
}

export default Footer;