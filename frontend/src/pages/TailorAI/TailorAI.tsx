import AgentChat from "../../components/AgentChat/AgentChat";
import type { AgentChatConfig } from "../../components/AgentChat/types";

/*
 * TailorAI is the only agent that personalises answers with the
 * saved career profile. Image upload is shared by every agent.
 */
const config: AgentChatConfig = {
  name: "TailorAI",
  subtitle: "AI Career Assistant",

  endpoint: "/tailor-ai",
  storageKey: "agentverse-tailor-chat-history-v2",

  usesCareerProfile: true,

  welcomeHeading: "How can I help with your career?",

  welcomeText:
    "Get career guidance, roadmaps, resume advice, and interview preparation.",

  placeholder:
    "Ask TailorAI anything about your career...",

  suggestions: [
    {
      label: "Build a developer roadmap",
      prompt: "Create a Python developer roadmap",
    },
    {
      label: "Improve my resume",
      prompt: "How can I improve my resume?",
    },
    {
      label: "Prepare for an interview",
      prompt: "Prepare me for a technical interview",
    },
  ],
};

function TailorAI() {
  return <AgentChat config={config} />;
}

export default TailorAI;
