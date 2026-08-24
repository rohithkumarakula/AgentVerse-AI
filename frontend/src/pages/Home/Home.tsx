import "./Home.css";

import Navbar from "../../components/Navbar/Navbar";
import Hero from "../../components/Hero/Hero";
import AgentCard from "../../components/AgentCard/AgentCard";
import Footer from "../../components/Footer/Footer";

const agents = [
  {
    icon: "AI",
    title: "TailorAI",
    description:
      "Your personal AI assistant for career and professional growth.",
    route: "/tailor-ai",
    category: "Career",
    status: "online" as const,
    suggestedPrompts: [
      "Improve my resume",
      "Prepare for interviews",
      "Career guidance",
    ],
  },
  {
    icon: "ST",
    title: "StudyAI",
    description:
      "Learn smarter with AI-powered study assistance.",
    route: "/study-ai",
    category: "Education",
    status: "online" as const,
    suggestedPrompts: [
      "Explain a topic",
      "Create a study plan",
      "Take a quiz",
    ],
  },
  {
    icon: "LI",
    title: "LifeAI",
    description:
      "Organize your goals, habits and productivity.",
    route: "/life-ai",
    category: "Productivity",
    status: "online" as const,
    suggestedPrompts: [
      "Set my goals",
      "Build a routine",
      "Track my habits",
    ],
  },
];

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