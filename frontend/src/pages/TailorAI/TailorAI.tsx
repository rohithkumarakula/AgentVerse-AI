import "./TailorAI.css";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

import Footer from "../../components/Footer/Footer";

type Message = {
  text: string;
  sender: "user" | "ai";
};

function TailorAI() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState("");

  const chatMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chat = chatMessagesRef.current;

    if (chat) {
      chat.scrollTo({
        top: chat.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

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
              {copiedCode === code ? "✓ Copied" : "📋 Copy"}
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

  async function handleSend(prompt?: string) {
    const userMessage = (prompt ?? input).trim();

    if (userMessage === "" || loading) return;

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
            history: messages,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Backend request failed");
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
          text: "Sorry, I couldn't connect to the backend.",
          sender: "ai",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="tailor-page">
        <div className="tailor-header">
          <div className="tailor-brand">
            <div className="tailor-icon">🤖</div>

            <div>
              <h1>TailorAI</h1>

              <div className="tailor-status">
                <span></span>
                AI Career Assistant
              </div>
            </div>
          </div>

          <p>Your personal AI career assistant.</p>
        </div>

        <div className="chat-container">
          <div
            className="chat-messages"
            ref={chatMessagesRef}
          >
            <div className="ai-message">
              👋 Hi! I'm TailorAI. How can I help with your career today?

              <div className="suggested-prompts">
                <p>Try asking TailorAI:</p>

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
              <div className="ai-message">
                TailorAI is thinking...
              </div>
            )}
          </div>

          <div className="chat-input">
            <input
              type="text"
              placeholder="Ask TailorAI anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSend();
                }
              }}
            />

            <button
              onClick={() => handleSend()}
              disabled={loading}
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