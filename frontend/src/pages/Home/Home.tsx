import "./Home.css";

import { useEffect, useState } from "react";

import Navbar from "../../components/Navbar/Navbar";
import Hero from "../../components/Hero/Hero";
import AgentCard from "../../components/AgentCard/AgentCard";
import Footer from "../../components/Footer/Footer";

import { getWelcomeMessage } from "../../services/api";

const agents = [
  {
    icon: "🤖",
    title: "TailorAI",
    description: "Your personal AI assistant for everyday tasks.",
  },
  {
    icon: "📚",
    title: "StudyAI",
    description: "Learn smarter with AI-powered study assistance.",
  },
  {
    icon: "🧠",
    title: "LifeAI",
    description: "Organize your goals, habits and productivity.",
  },
];

function Home() {
  const [message, setMessage] = useState("");

  useEffect(() => {
  async function loadData() {
    const data = await getWelcomeMessage();
    setMessage(data.message);
  }

  loadData();
}, []);

  return (
    <>
      <Navbar />

      <>
        <h2
          style={{
             textAlign: "center",
             color: "#38bdf8",
             marginTop: "20px",
             fontSize: "28px",
             fontWeight: "bold",
           }}
        >
         {message}
        </h2>

        <Hero />
      </>

      <section className="agents-section">
        <h2>Meet Your AI Agents</h2>

        <div className="agent-grid">
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

export default Home;