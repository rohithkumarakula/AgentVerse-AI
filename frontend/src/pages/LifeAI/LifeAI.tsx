import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./LifeAI.css";

interface Message {
  text: string;
  sender: "user" | "ai";
}

const API_URL = "http://127.0.0.1:8000/life-ai";

function LifeAI() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async (text?: string) => {
    const userMessage = (text ?? message).trim();

    if (!userMessage || loading) return;

    // Add user's message immediately
    setMessages((prev) => [
      ...prev,
      {
        text: userMessage,
        sender: "user",
      },
    ]);

    setMessage("");
    setLoading(true);

    try {
      // Send previous conversation history to backend
      const history = messages.map((msg) => ({
        text: msg.text,
        sender: msg.sender,
      }));

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          history,
        }),
      });

      if (!response.ok) {
        throw new Error("LifeAI request failed");
      }

      const data = await response.json();

      // Add AI response
      setMessages((prev) => [
        ...prev,
        {
          text:
            data.reply ||
            "Sorry, I couldn't generate a response.",
          sender: "ai",
        },
      ]);
    } catch (error) {
      console.error("LifeAI Error:", error);

      setMessages((prev) => [
        ...prev,
        {
          text:
            "Sorry, something went wrong. Please make sure the backend server is running.",
          sender: "ai",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="life-ai-page">
      <div className="life-ai-container">

        {/* ================= HEADER ================= */}

        <div className="life-ai-header">
          <div className="life-ai-icon">🧠</div>

          <div>
            <h1>LifeAI</h1>
            <p>
              Your AI assistant for goals, habits and productivity.
            </p>
          </div>
        </div>

        {/* ================= CONTENT ================= */}

        <div className="life-ai-content">

          {/* ================= WELCOME ================= */}

          {messages.length === 0 && (
            <div className="life-ai-welcome">
              <div className="welcome-icon">✨</div>

              <h2>How can I help you today?</h2>

              <p>
                Build better routines, organize your goals,
                improve productivity and develop better habits.
              </p>

              <div className="life-ai-prompts">

                <button
                  onClick={() =>
                    sendMessage("Help me set my goals")
                  }
                >
                  🎯 Set my goals
                </button>

                <button
                  onClick={() =>
                    sendMessage(
                      "Help me build a productive daily routine"
                    )
                  }
                >
                  📅 Build a routine
                </button>

                <button
                  onClick={() =>
                    sendMessage(
                      "Help me create a habit tracking plan"
                    )
                  }
                >
                  🔥 Track my habits
                </button>

              </div>
            </div>
          )}

          {/* ================= MESSAGES ================= */}

          <div className="life-ai-messages">

            {messages.map((msg, index) => (
              <div
                key={index}
                className={`life-ai-message ${
                  msg.sender === "user"
                    ? "user-message"
                    : "ai-message"
                }`}
              >

                <div className="message-label">
                  {msg.sender === "user" ? "You" : "LifeAI"}
                </div>

                <div className="message-text">
                  {msg.sender === "ai" ? (
                    <ReactMarkdown  remarkPlugins={[remarkGfm]}>
                      {msg.text}
                    </ReactMarkdown>
                  ) : (
                    msg.text
                  )}
                </div>

              </div>
            ))}

            {/* ================= LOADING ================= */}

            {loading && (
              <div className="life-ai-message ai-message">

                <div className="message-label">
                  LifeAI
                </div>

                <div className="typing">
                  LifeAI is thinking...
                </div>

              </div>
            )}

          </div>
        </div>

        {/* ================= INPUT ================= */}

        <div className="life-ai-input-area">

          <input
            type="text"
            value={message}
            placeholder="Ask LifeAI anything..."
            onChange={(e) =>
              setMessage(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            disabled={loading}
          />

          <button
            className="send-button"
            onClick={() => sendMessage()}
            disabled={
              loading || !message.trim()
            }
          >
            {loading ? "..." : "Send"}
          </button>

        </div>

      </div>
    </div>
  );
}

export default LifeAI;