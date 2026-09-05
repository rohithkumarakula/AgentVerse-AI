import AgentChat from "../../components/AgentChat/AgentChat";
import type { AgentChatConfig } from "../../components/AgentChat/types";

const config: AgentChatConfig = {
  name: "HealthAI",
  subtitle: "AI Health Assistant",

  endpoint: "/health-ai",
  storageKey: "agentverse-health-chat-history-v2",

  welcomeHeading: "How can I help with your health?",

  welcomeText:
    "Learn about wellness, fitness, nutrition, and healthy routines.",

  placeholder:
    "Ask HealthAI anything about fitness and nutrition...",

  disclaimer:
    "HealthAI shares general information, not medical advice. Speak to a professional about symptoms.",

  suggestions: [
    {
      label: "Create a fitness routine",
      prompt:
        "Create a beginner 4-week fitness routine",
    },
    {
      label: "Explain nutrition basics",
      prompt:
        "Explain carbohydrates, protein, and fats",
    },
    {
      label: "Build a healthy routine",
      prompt: "Create a healthy daily routine",
    },
  ],
};

function HealthAI() {
  return <AgentChat config={config} />;
}

export default HealthAI;
