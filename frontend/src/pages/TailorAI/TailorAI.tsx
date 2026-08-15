import "./TailorAI.css";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import CareerProfile from "../../components/careerProfile/careerProfile";
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

function TailorAI() {
  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<Message[]>(() => {
    const savedChat = localStorage.getItem(CHAT_STORAGE_KEY);

    if (!savedChat) {
      return [];
    }

    try {
      const parsed = JSON.parse(savedChat);

      if (Array.isArray(parsed)) {
        return parsed;
      }

      return [];
    } catch {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");

  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // =========================================
  // SAVE CHAT HISTORY
  // =========================================

  useEffect(() => {
    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify(messages)
    );
  }, [messages]);

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
  // MARKDOWN
  // =========================================

  const markdownComponents: Components = {
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
            "Sorry, I couldn't connect to the backend.",
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
      <section className="tailor-page">

        <CareerProfile />

        <div className="tailor-header">

          <div className="tailor-brand">

            <div className="tailor-icon">
              AI
            </div>

            <div>
              <h1>TailorAI</h1>

              <div className="tailor-status">
                <span></span>
                AI Career Assistant
              </div>
            </div>

          </div>

          <p>
            Your personal AI career assistant.
          </p>

          <button
            className="clear-chat-btn"
            onClick={handleClearChat}
            disabled={
              messages.length === 0 || loading
            }
          >
            Clear Chat
          </button>

        </div>

        <div className="chat-container">

          <div
            className="chat-messages"
            ref={chatMessagesRef}
          >

            {messages.length === 0 && (
              <div className="ai-message">

                Hi! I'm TailorAI. How can I help
                with your career today?

                <div className="suggested-prompts">

                  <p>
                    Try asking TailorAI:
                  </p>

                  <div className="prompt-list">

                    <button
                      onClick={() =>
                        handleSend(
                          "Create a Python developer roadmap"
                        )
                      }
                      disabled={loading}
                    >
                      Create a Python developer roadmap
                    </button>

                    <button
                      onClick={() =>
                        handleSend(
                          "How can I improve my resume?"
                        )
                      }
                      disabled={loading}
                    >
                      How can I improve my resume?
                    </button>

                    <button
                      onClick={() =>
                        handleSend(
                          "Prepare me for a technical interview"
                        )
                      }
                      disabled={loading}
                    >
                      Prepare me for a technical interview
                    </button>

                  </div>

                </div>

              </div>
            )}

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
                    components={markdownComponents}
                  >
                    {message.text}
                  </ReactMarkdown>
                ) : (
                  message.text
                )}
              </div>
            ))}

            {loading && (
              <div className="ai-message typing-message">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            )}

          </div>

          <div className="chat-input">

            <input
              type="text"
              placeholder="Ask TailorAI anything..."
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