import "./Agents.css";
import { useState } from "react";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import AgentCard from "../../components/AgentCard/AgentCard";

import { agents } from "../../data/agents";

function Agents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const filteredAgents = agents.filter((agent) => {
  const search = searchTerm.toLowerCase();
  const categoryMatch =
  selectedCategory === "All" ||
  agent.category === selectedCategory;

  return (
  categoryMatch &&
  (
    agent.title.toLowerCase().includes(search) ||
    agent.category.toLowerCase().includes(search) ||
    agent.description.toLowerCase().includes(search) ||
    agent.suggestedPrompts.some((prompt) =>
      prompt.toLowerCase().includes(search)
    )
  )
);
});

  return (
    <>
      <Navbar />

      <section className="agents-page">
        <h1>Explore AI Agents</h1>

        <p>Choose an AI agent based on your needs.</p>
        <div className="category-filters">
  {["All", ...new Set(agents.map((agent) => agent.category))].map(
    (category) => (
      <button
        key={category}
        className={selectedCategory === category ? "active" : ""}
        onClick={() => setSelectedCategory(category)}
      >
        {category}
      </button>
    )
  )}
</div>
        <div className="agent-search">
          <input
            type="text"
            placeholder="Search AI agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
    <button
      className="clear-search"
      onClick={() => setSearchTerm("")}
      aria-label="Clear search"
    >
      ×
    </button>
  )}
        </div>

        <div className="agents-grid">
          {filteredAgents.map((agent) => (
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

        {filteredAgents.length === 0 && (
          <div className="no-agents">
            <h3>No agents found</h3>
            <p>Try searching for a different agent or category.</p>
          </div>
        )}
      </section>

      <Footer />
    </>
  );
}

export default Agents;