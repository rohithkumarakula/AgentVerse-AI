import "./TailorAI.css";
import { useState } from "react";

import Navbar from "../../components/Navbar/Navbar";
import Footer from "../../components/Footer/Footer";

type Message = {
  text: string;
  sender: "user" | "ai";
};

function TailorAI() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (input.trim() === "" || loading) return;

    const userMessage = input.trim();

    setMessages((prev) => [
      ...prev,
      { text: userMessage, sender: "user" },
    ]);

    setInput("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8001/tailor-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
        }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        { text: data.reply, sender: "ai" },
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
      <Navbar />

      <section className="tailor-page">
        <div className="tailor-header">
          <h1>🤖 TailorAI</h1>
          <p>Your personal AI career assistant.</p>
        </div>

        <div className="chat-container">
          <div className="chat-messages">
            <div className="ai-message">
              👋 Hi! I'm TailorAI. How can I help with your career today?
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
                {message.text}
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

            <button onClick={handleSend} disabled={loading}>
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