import "./Home.css";

import Navbar from "../../components/Navbar/Navbar";
import Hero from "../../components/Hero/Hero";
import AgentCard from "../../components/AgentCard/AgentCard";
import Footer from "../../components/Footer/Footer";
import { agents } from "../../data/agents";

function Home() {
  return (
    <>
      <Navbar />

      <main className="home-page">

        <Hero />

        <section
          id="agents-section"
          className="agents-section"
        >

          <div className="agents-section-header">

            <span className="section-label">
              AI WORKSPACE
            </span>

            <h2>
              Meet Your AI Agents
            </h2>

            <p>
              Specialized AI assistants designed to help
              you work, learn and grow.
            </p>

          </div>

          <div className="agent-grid">

            {agents.map((agent) => (
              <AgentCard
                key={agent.title}
                icon={agent.icon}
                title={agent.title}
                description={agent.description}
                route={agent.route}
                category={agent.category}
                status={agent.status}
              />
            ))}

          </div>

        </section>

      </main>

      <Footer />
    </>
  );
}

export default Home;