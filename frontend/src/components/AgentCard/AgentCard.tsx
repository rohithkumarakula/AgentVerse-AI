import "./AgentCard.css";
import { useNavigate } from "react-router-dom";

type AgentCardProps = {
  title: string;
  description: string;
  icon: string;
  route: string;
  category: string;
  status: "online" | "coming-soon";
  suggestedPrompts: string[];
};

function AgentCard({
  title,
  description,
  icon,
  route,
  category,
  status,
  suggestedPrompts = [],
}: AgentCardProps) {
  const navigate = useNavigate();

  function handleExplore() {
    if (status === "online") {
      navigate(route);
    }
  }

  return (
    <div className="agent-card">
      <div className="agent-card-top">
        <div className="agent-icon">{icon}</div>

        <span className={`agent-status ${status}`}>
          <span className="status-dot"></span>
          {status === "online" ? "Online" : "Coming Soon"}
        </span>
      </div>

      <h3>{title}</h3>

      <span className="agent-category">
        {category}
      </span>

      <p>{description}</p>

      <div className="agent-prompts">
        {suggestedPrompts.map((prompt) => (
          <span key={prompt}>{prompt}</span>
        ))}
      </div>

      <button
        onClick={handleExplore}
        disabled={status !== "online"}
      >
        {status === "online" ? "Explore" : "Coming Soon"}
      </button>
    </div>
  );
}

export default AgentCard;