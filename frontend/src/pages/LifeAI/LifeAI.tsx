import AgentChat from "../../components/AgentChat/AgentChat";
import type { AgentChatConfig } from "../../components/AgentChat/types";

const config: AgentChatConfig = {
  name: "LifeAI",
  subtitle: "AI Productivity Assistant",

  endpoint: "/life-ai",
  storageKey: "agentverse-life-chat-history-v2",

  welcomeHeading: "How can I help with your day?",

  welcomeText:
    "Set goals, build habits, plan routines, and stay on top of your tasks.",

  placeholder:
    "Ask LifeAI anything about goals, habits, and routines...",

  suggestions: [
    {
      label: "Set my goals",
      prompt: "Help me set my goals",
    },
    {
      label: "Build a daily routine",
      prompt: "Help me build a productive daily routine",
    },
    {
      label: "Start a habit plan",
      prompt: "Create a 30-day habit-building plan",
    },
  ],
};

function LifeAI() {
  return <AgentChat config={config} />;
}

export default LifeAI;
