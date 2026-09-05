import AgentChat from "../../components/AgentChat/AgentChat";
import type { AgentChatConfig } from "../../components/AgentChat/types";

const config: AgentChatConfig = {
  name: "FinanceAI",
  subtitle: "AI Finance Assistant",

  endpoint: "/finance-ai",
  storageKey: "agentverse-finance-chat-history-v2",

  welcomeHeading: "How can I help with your finances?",

  welcomeText:
    "Learn personal finance, plan budgets, and build stronger financial habits.",

  placeholder:
    "Ask FinanceAI anything about money and budgeting...",

  disclaimer:
    "FinanceAI shares general financial education, not professional advice. Check important information.",

  suggestions: [
    {
      label: "Create a monthly budget",
      prompt:
        "Create a monthly budget for a 50000 income",
    },
    {
      label: "Explain finance basics",
      prompt:
        "Explain saving, investing, and emergency funds",
    },
    {
      label: "Build a finance roadmap",
      prompt:
        "Create a 12-month personal finance roadmap",
    },
  ],
};

function FinanceAI() {
  return <AgentChat config={config} />;
}

export default FinanceAI;
