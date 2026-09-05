import AgentChat from "../../components/AgentChat/AgentChat";
import type { AgentChatConfig } from "../../components/AgentChat/types";

/*
 * StudyAI is the only agent that needs session_id: the backend
 * tracks quiz progress per session, and replies with structured
 * quiz payloads that <AgentChat /> renders as markdown.
 */
const config: AgentChatConfig = {
  name: "StudyAI",
  subtitle: "AI Study Assistant",

  endpoint: "/study-ai",
  storageKey: "agentverse-study-chat-history-v2",
  sendsSessionId: true,

  welcomeHeading: "How can I help with your studies?",

  welcomeText:
    "Understand topics, build study plans, practise questions, and prepare for exams.",

  placeholder:
    "Ask StudyAI anything about your studies...",

  suggestions: [
    {
      label: "Explain a topic simply",
      prompt: "Explain DBMS for a beginner",
    },
    {
      label: "Build a study plan",
      prompt: "Create a 7-day Python study plan",
    },
    {
      label: "Quiz me",
      prompt: "Give me a quiz on operating systems",
    },
  ],
};

function StudyAI() {
  return <AgentChat config={config} />;
}

export default StudyAI;
