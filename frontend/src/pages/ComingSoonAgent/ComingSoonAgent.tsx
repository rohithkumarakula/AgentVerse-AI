import { useLocation } from "react-router-dom";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import "./ComingSoonAgent.css";

function ComingSoonAgent() {
  const location = useLocation();
  const pathname = location.pathname.replace("/", "").replace("-", " ");
  const title = pathname
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <>
      <Navbar />

      <main className="coming-soon-page">
        <section className="coming-soon-card">
          <span className="coming-soon-badge">Coming Soon</span>

          <h1>{title}</h1>

          <p>
            This agent is in the AgentVerse AI roadmap and is being prepared for
            release. The current build keeps the existing design intact while
            making the agent visible and routed correctly.
          </p>

          <div className="coming-soon-actions">
            <button type="button" onClick={() => window.history.back()}>
              Go Back
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

export default ComingSoonAgent;
