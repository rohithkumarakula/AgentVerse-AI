import "./AgentCard.css";
import { useNavigate } from "react-router-dom";

type AgentCardProps = {
  title: string;
  description: string;
  icon: string;
};

function AgentCard({ title, description, icon }: AgentCardProps) {
  const navigate = useNavigate();

  function handleExplore() {
    if (title === "TailorAI") {
      navigate("/tailor-ai");
    }
  }

  return (
    <div className="agent-card">
      <div className="agent-icon">{icon}</div>

      <h3>{title}</h3>

      <p>{description}</p>

      <button onClick={handleExplore}>Explore</button>
    </div>
  );
}

export default AgentCard;