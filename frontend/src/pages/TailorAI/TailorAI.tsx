import "./TailorAI.css";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

type Message = {
  text: string;
  sender: "user" | "ai";
};

type CareerProfileData = {
  skills: string;
  targetRole: string;
  experience: string;
  timeline: string;
  salaryGoal: string;
};

const CHAT_STORAGE_KEY = "agentverse-tailor-chat";
const PROFILE_STORAGE_KEY = "agentverse-career-profile";

function cleanMarkdown(text: string): string {
  if (!text) return "";

  return text
    .replace(/<br\s*\/?>/gi, "\n\n")
    .replace(/\\n/g, "\n");
}

function TailorAI() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");

  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // =========================================
  // CLEAN OLD CHAT ON PAGE LOAD / UNMOUNT
  // =========================================

  useEffect(() => {
    localStorage.removeItem(CHAT_STORAGE_KEY);

    return () => {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    };
  }, []);

  // =========================================
  // AUTO SCROLL
  // =========================================

  useEffect(() => {
    const chat = chatMessagesRef.current;

    if (chat) {
      chat.scrollTo({
        top: chat.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  // =========================================
  // COPY CODE
  // =========================================

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);

      setCopiedCode(code);

      setTimeout(() => {
        setCopiedCode("");
      }, 2000);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  }

  // =========================================
  // CLEAR CHAT
  // =========================================

  function handleClearChat() {
    setMessages([]);
    setInput("");
    localStorage.removeItem(CHAT_STORAGE_KEY);
  }

  // =========================================
  // GET CAREER PROFILE
  // =========================================

  function getCareerProfile(): CareerProfileData | null {
    const savedProfile = localStorage.getItem(
      PROFILE_STORAGE_KEY
    );

    if (!savedProfile) {
      return null;
    }

    try {
      const parsed = JSON.parse(savedProfile);

      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      const profile: CareerProfileData = {
        skills:
          typeof parsed.skills === "string"
            ? parsed.skills.trim()
            : "",

        targetRole:
          typeof parsed.targetRole === "string"
            ? parsed.targetRole.trim()
            : "",

        experience:
          typeof parsed.experience === "string"
            ? parsed.experience.trim()
            : "",

        timeline:
          typeof parsed.timeline === "string"
            ? parsed.timeline.trim()
            : "",

        salaryGoal:
          typeof parsed.salaryGoal === "string"
            ? parsed.salaryGoal.trim()
            : "",
      };

      const hasProfileData =
        profile.skills !== "" ||
        profile.targetRole !== "" ||
        profile.experience !== "" ||
        profile.timeline !== "" ||
        profile.salaryGoal !== "";

      if (!hasProfileData) {
        return null;
      }

      return profile;
    } catch (error) {
      console.error(
        "Career profile parsing failed:",
        error
      );

      return null;
    }
  }

  // =========================================
  // MARKDOWN COMPONENTS
  // =========================================

  const markdownComponents: Components = {
    table({ children }) {
      return (
        <div className="table-wrapper">
          <table>{children}</table>
        </div>
      );
    },

    code({ className, children, ...props }) {
      const code = String(children).replace(/\n$/, "");
      const isCodeBlock = Boolean(className);

      if (!isCodeBlock) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }

      return (
        <div className="code-block-wrapper">
          <div className="code-block-header">
            <span>Code</span>

            <button
              className="copy-code-btn"
              onClick={() => handleCopy(code)}
              type="button"
            >
              {copiedCode === code ? "Copied" : "Copy"}
            </button>
          </div>

          <pre>
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        </div>
      );
    },
  };

  // =========================================
  // SEND MESSAGE
  // =========================================

  async function handleSend(prompt?: string) {
    const userMessage = (prompt ?? input).trim();

    if (userMessage === "" || loading) {
      return;
    }

    const careerProfile = getCareerProfile();
    const previousMessages = [...messages];

    setMessages((prev) => [
      ...prev,
      {
        text: userMessage,
        sender: "user",
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/tailor-ai",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            message: userMessage,
            history: previousMessages,
            profile: careerProfile,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Backend request failed: ${response.status}`
        );
      }

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          text: data.reply,
          sender: "ai",
        },
      ]);
    } catch (error) {
      console.error("TailorAI Error:", error);

      setMessages((prev) => [
        ...prev,
        {
          text:
            "Sorry, I couldn't connect to the backend. Please make sure the backend server is running.",
          sender: "ai",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // UI
  // =========================================

  return (
    <>
      <Navbar />

      <section className="tailor-page">

        {/* =========================================
            TAILOR AI HEADER
        ========================================= */}

        <div className="tailor-header">

          <div className="tailor-brand">

            <div className="tailor-icon">
              🤖
            </div>

            <div className="tailor-title-block">

              <h1>TailorAI</h1>

              <div className="tailor-status">
                <span className="status-dot"></span>
                AI Career Assistant
              </div>

            </div>

          </div>

          <p>
            Your personal AI assistant for career guidance,
            roadmaps, and interview preparation.
          </p>

          <button
            type="button"
            className="clear-chat-btn"
            onClick={handleClearChat}
            disabled={
              loading ||
              (messages.length === 0 && input.trim() === "")
            }
          >
            Clear Chat
          </button>

        </div>

        {/* =========================================
            CHAT CONTAINER
        ========================================= */}

        <div className="chat-container">

          {/* =========================================
              CHAT MESSAGES
          ========================================= */}

          <div
            className="chat-messages"
            ref={chatMessagesRef}
          >

            {/* =========================================
                WELCOME MESSAGE
            ========================================= */}

            {messages.length === 0 && (
              <div className="ai-message welcome-ai-message">

                <p>
                  Hi! I'm{" "}
                  <strong>TailorAI</strong>, your personal
                  career and placement assistant. How can I
                  help you today?
                </p>

                <div className="suggested-prompts">

                  <p>
                    Try asking TailorAI:
                  </p>

                  <div className="prompt-list">

                    <button
                      type="button"
                      onClick={() =>
                        handleSend(
                          "Create a Python developer roadmap"
                        )
                      }
                      disabled={loading}
                    >
                      🚀 Create a Python developer roadmap
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSend(
                          "How can I improve my resume?"
                        )
                      }
                      disabled={loading}
                    >
                      📄 How can I improve my resume?
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSend(
                          "Prepare me for a technical interview"
                        )
                      }
                      disabled={loading}
                    >
                      🎯 Prepare me for a technical interview
                    </button>

                  </div>

                </div>

              </div>
            )}

            {/* =========================================
                CHAT MESSAGES
            ========================================= */}

            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.sender === "user"
                    ? "user-message"
                    : "ai-message"
                }
              >

                {message.sender === "ai" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {cleanMarkdown(message.text)}
                  </ReactMarkdown>
                ) : (
                  message.text
                )}

              </div>
            ))}

            {/* =========================================
                TYPING INDICATOR
            ========================================= */}

            {loading && (
              <div className="ai-message typing-message">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            )}

          </div>

          {/* =========================================
              CHAT INPUT
          ========================================= */}

          <div className="chat-input">

            <input
              type="text"
              placeholder="Ask TailorAI anything about your career..."
              value={input}
              onChange={(e) =>
                setInput(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSend();
                }
              }}
              disabled={loading}
            />

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={
                loading || input.trim() === ""
              }
            >
              {loading ? "Sending..." : "Send"}
            </button>

          </div>

        </div>

      </section>

      <Footer />
    </>
  );
}

export default TailorAI;