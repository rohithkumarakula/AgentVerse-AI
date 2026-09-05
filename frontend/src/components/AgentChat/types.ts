/* =========================================================
   AGENT CHAT — SHARED TYPES
   ---------------------------------------------------------
   All six agent pages render the same <AgentChat /> shell and
   differ only through the config object they pass to it.
   ========================================================= */

export type MessageAttachment = {
  name: string;
  type: string;
  dataUrl?: string;
};

export type Message = {
  id: string;
  text: string;
  sender: "user" | "ai";
  attachment?: MessageAttachment;

  /* Errors stay visible in the transcript but are never
     replayed to the model as conversation context. */
  isError?: boolean;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
};

export type SuggestedPrompt = {
  label: string;
  prompt: string;
};

export type AgentChatConfig = {
  /* Centred in the top bar. */
  name: string;

  /* Shown on the right of the top bar. */
  subtitle: string;

  /* Backend path, e.g. "/code-ai". */
  endpoint: string;

  /* localStorage key for this agent's chat history. */
  storageKey: string;

  welcomeHeading: string;
  welcomeText: string;
  placeholder: string;
  disclaimer?: string;

  suggestions: SuggestedPrompt[];

  /* /study-ai requires session_id and can answer with a quiz. */
  sendsSessionId?: boolean;

  /* /tailor-ai personalises answers with the saved career profile. */
  usesCareerProfile?: boolean;
};
