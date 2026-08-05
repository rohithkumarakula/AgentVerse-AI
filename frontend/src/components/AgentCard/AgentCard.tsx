import "./AgentCard.css";

type AgentCardProps = {
  title: string;
  description: string;
  icon: string;
};

function AgentCard({ title, description, icon }: AgentCardProps) {
  return (
    <div className="agent-card">
      <div className="agent-icon">{icon}</div>

      <h3>{title}</h3>

      <p>{description}</p>

      <button>Explore</button>
    </div>
  );
}

export default AgentCard;