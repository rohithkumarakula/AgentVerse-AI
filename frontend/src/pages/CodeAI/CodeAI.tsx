import AgentChat from "../../components/AgentChat/AgentChat";
import type { AgentChatConfig } from "../../components/AgentChat/types";

/*
 * Only the copy, the endpoint and the storage key are specific
 * to CodeAI. The chat layout and behaviour are shared with the
 * other agents through <AgentChat />.
 */
const config: AgentChatConfig = {
  name: "CodeAI",
  subtitle: "AI Coding Assistant",

  endpoint: "/code-ai",
  storageKey: "agentverse-code-chat-history-v2",

  welcomeHeading: "How can I help with your code?",

  welcomeText:
    "Explain concepts, debug programs, and build better software.",

  placeholder:
    "Ask CodeAI anything about programming and code...",

  suggestions: [
    {
      label: "Explain Python OOP",
      prompt: "Explain Python OOP with examples",
    },
    {
      label: "Debug my code",
      prompt:
        "Debug this Python code and explain the error",
    },
    {
      label: "Compare languages",
      prompt:
        "Compare Python, Java, and JavaScript in a table",
    },
  ],
};

function CodeAI() {
  return <AgentChat config={config} />;
}

export default CodeAI;
