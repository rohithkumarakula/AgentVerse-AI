import "./Agents.css";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import AgentCard from "../../components/AgentCard/AgentCard";

import { agents } from "../../data/agents";

function Agents() {
  return (
    <>
      <Navbar />

      <section className="agents-page">
        <h1>Explore AI Agents</h1>

        <p>
          Choose an AI agent based on your needs.
        </p>

        <div className="agents-grid">
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

      <Footer />
    </>
  );
}

export default Agents;