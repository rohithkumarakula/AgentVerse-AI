import "./Agents.css";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";
import AgentCard from "../../components/AgentCard/AgentCard";

const agents = [
  {
    icon: "🤖",
    title: "TailorAI",
    description: "Your personal AI assistant for career guidance.",
  },
  {
    icon: "📚",
    title: "StudyAI",
    description: "AI-powered learning assistant for students.",
  },
  {
    icon: "🧠",
    title: "LifeAI",
    description: "Manage habits, goals and productivity.",
  },
  {
    icon: "💻",
    title: "CodeAI",
    description: "Your coding companion for development.",
  },
  {
    icon: "💰",
    title: "FinanceAI",
    description: "Track expenses and manage your finances.",
  },
  {
    icon: "🏋️",
    title: "HealthAI",
    description: "Fitness, diet and wellness assistant.",
  },
];

function Agents() {
  return (
    <>
      <Navbar />

      <section className="agents-page">
        <h1>Explore AI Agents</h1>
        <p>Choose an AI agent based on your needs.</p>

        <div className="agents-grid">
          {agents.map((agent) => (
            <AgentCard
              key={agent.title}
              icon={agent.icon}
              title={agent.title}
              description={agent.description}
            />
          ))}
        </div>
      </section>

      <Footer />
    </>
  );
}

export default Agents;