export type Agent = {
  icon: string;
  title: string;
  description: string;
  route: string;
  category: string;
  status: "online" | "coming-soon";
  suggestedPrompts: string[];
};

export const agents: Agent[] = [
  {
    icon: "🤖",
    title: "TailorAI",
    description: "Your personal AI assistant for career guidance.",
    route: "/tailor-ai",
    category: "Career & Placement",
    status: "online",
    suggestedPrompts: [
      "Create a Python developer roadmap",
      "How can I improve my resume?",
      "Prepare me for a technical interview",
    ],
  },

  {
    icon: "📚",
    title: "StudyAI",
    description: "AI-powered learning assistant for students.",
    route: "/study-ai",
    category: "Education",
    status: "online",
    suggestedPrompts: [
      "Create a study plan",
      "Explain this topic simply",
      "Help me prepare for an exam",
    ],
  },

  {
    icon: "🧠",
    title: "LifeAI",
    description: "Manage habits, goals and productivity.",
    route: "/life-ai",
    category: "Productivity",
    status: "online",
    suggestedPrompts: [
      "Create a daily routine",
      "Help me set my goals",
      "How can I improve my productivity?",
    ],
  },

  {
    icon: "💻",
    title: "CodeAI",
    description: "Coding assistant for development.",
    route: "/code-ai",
    category: "Programming",
    status: "online",
    suggestedPrompts: [
      "Explain this code",
      "Help me debug my program",
      "Give me a coding roadmap",
    ],
  },

  {
    icon: "💰",
    title: "FinanceAI",
    description: "Assistant for personal finance and financial education.",
    route: "/finance-ai",
    category: "Finance",
    status: "online",
    suggestedPrompts: [
      "Create a monthly budget",
      "Help me track my expenses",
      "Explain personal finance basics",
    ],
  },

  {
    icon: "🏋️",
    title: "HealthAI",
    description: "Assistant for fitness, nutrition and wellness.",
    route: "/health-ai",
    category: "Health & Fitness",
    status: "online",
    suggestedPrompts: [
      "Create a workout routine",
      "Help me build healthy habits",
      "Create a fitness plan",
    ],
  },
];