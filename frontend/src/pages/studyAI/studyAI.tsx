import "./studyAI.css";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import Footer from "../../components/Footer/Footer";

type Message = {
  text: string;
  sender: "user" | "ai";
};

type QuizState = {
  quiz_id: string;
  topic: string;
  question_number: number;
  total_questions: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
};

const CHAT_STORAGE_KEY = "agentverse-study-chat";
const SESSION_STORAGE_KEY = "agentverse-study-session";

function getSessionId(): string {
  const existingSessionId =
    localStorage.getItem(SESSION_STORAGE_KEY);

  if (existingSessionId) {
    return existingSessionId;
  }

  const newSessionId = crypto.randomUUID();

  localStorage.setItem(
    SESSION_STORAGE_KEY,
    newSessionId
  );

  return newSessionId;
}

function StudyAI() {
  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<Message[]>(() => {
    const savedChat =
      localStorage.getItem(CHAT_STORAGE_KEY);

    if (!savedChat) {
      return [];
    }

    try {
      const parsed = JSON.parse(savedChat);

      if (!Array.isArray(parsed)) {
        return [];
      }

      const validMessages = parsed.filter(
        (message): message is Message =>
          message &&
          typeof message === "object" &&
          typeof message.text === "string" &&
          (message.sender === "user" ||
            message.sender === "ai")
      );

      return validMessages;
    } catch (error) {
      console.error(
        "StudyAI chat history parsing failed:",
        error
      );

      localStorage.removeItem(CHAT_STORAGE_KEY);

      return [];
    }
  });

  const [loading, setLoading] = useState(false);

  const [copiedCode, setCopiedCode] =
    useState("");

  const [quiz, setQuiz] =
    useState<QuizState | null>(null);

  const [quizFeedback, setQuizFeedback] =
    useState("");

  const [quizScore, setQuizScore] =
    useState<number | null>(null);

  const chatMessagesRef =
    useRef<HTMLDivElement>(null);

  const sessionId = getSessionId();

  // =========================================
  // SAVE CHAT HISTORY
  // =========================================

  useEffect(() => {
    try {
      if (messages.length === 0) {
        localStorage.removeItem(
          CHAT_STORAGE_KEY
        );
        return;
      }

      localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify(messages)
      );
    } catch (error) {
      console.error(
        "StudyAI chat history save failed:",
        error
      );
    }
  }, [messages]);

  // =========================================
  // AUTO SCROLL
  // =========================================

  useEffect(() => {
    const chat = chatMessagesRef.current;

    if (!chat) {
      return;
    }

    chat.scrollTo({
      top: chat.scrollHeight,
      behavior: "smooth",
    });
  }, [
    messages,
    loading,
    quiz,
    quizFeedback,
  ]);

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
      console.error(
        "StudyAI copy failed:",
        error
      );
    }
  }

  // =========================================
  // CLEAR CHAT
  // =========================================

  function handleClearChat() {
    if (loading) {
      return;
    }

    setMessages([]);
    setInput("");
    setCopiedCode("");
    setQuiz(null);
    setQuizFeedback("");
    setQuizScore(null);

    localStorage.removeItem(
      CHAT_STORAGE_KEY
    );

    /*
     * Create a new session so an old quiz
     * session cannot interfere with a new chat.
     */
    const newSessionId = crypto.randomUUID();

    localStorage.setItem(
      SESSION_STORAGE_KEY,
      newSessionId
    );
  }

  // =========================================
  // MARKDOWN
  // =========================================

  const markdownComponents: Components = {
    code({ className, children, ...props }) {
      const code = String(children).replace(
        /\n$/,
        ""
      );

      const isCodeBlock =
        Boolean(className);

      if (!isCodeBlock) {
        return (
          <code
            className={className}
            {...props}
          >
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
              onClick={() =>
                handleCopy(code)
              }
              type="button"
            >
              {copiedCode === code
                ? "Copied"
                : "Copy"}
            </button>
          </div>

          <pre>
            <code
              className={className}
              {...props}
            >
              {children}
            </code>
          </pre>
        </div>
      );
    },
  };

  // =========================================
  // ADD AI MESSAGE
  // =========================================

  function addAIMessage(text: string) {
    setMessages((prev) => [
      ...prev,
      {
        text,
        sender: "ai",
      },
    ]);
  }

  // =========================================
  // HANDLE BACKEND RESPONSE
  // =========================================

  function handleBackendResponse(
    data: any
  ) {
    if (!data) {
      throw new Error(
        "Empty response received from StudyAI backend."
      );
    }

    // =======================================
    // NORMAL AI RESPONSE
    // =======================================

    if (data.type === "normal") {
      if (
        typeof data.reply !== "string"
      ) {
        throw new Error(
          "Invalid normal response received."
        );
      }

      addAIMessage(data.reply);

      return;
    }

    // =======================================
    // QUIZ SETUP
    // =======================================

    if (
      data.type === "quiz_setup"
    ) {
      setQuiz(null);
      setQuizFeedback("");
      setQuizScore(null);

      if (
        typeof data.message === "string"
      ) {
        addAIMessage(data.message);
      }

      return;
    }

    // =======================================
    // QUIZ ACTIVE
    // =======================================

    if (
      data.type === "quiz" &&
      data.status === "active"
    ) {
      setQuiz({
        quiz_id: data.quiz_id,
        topic: data.topic,
        question_number:
          data.question_number,
        total_questions:
          data.total_questions,
        question: data.question,
        options: data.options,
      });

      setQuizFeedback("");

      return;
    }

    // =======================================
    // QUIZ ANSWER RECEIVED
    // =======================================

    if (
      data.type === "quiz" &&
      data.status ===
        "answer_received"
    ) {
      const feedback = data.correct
        ? `Correct. The answer is ${data.correct_answer}.`
        : `Incorrect. You selected ${data.selected_answer}, but the correct answer is ${data.correct_answer}.`;

      const explanation =
        typeof data.explanation ===
        "string"
          ? `\n\n${data.explanation}`
          : "";

      setQuizFeedback(
        feedback + explanation
      );

      setQuizScore(
        typeof data.score === "number"
          ? data.score
          : null
      );

      setQuiz({
        quiz_id: quiz?.quiz_id ?? "",
        topic: quiz?.topic ?? "",
        question_number:
          data.question_number,
        total_questions:
          data.total_questions,
        question: data.question,
        options: data.options,
      });

      return;
    }

    // =======================================
    // QUIZ COMPLETE
    // =======================================

    if (
      data.type === "quiz" &&
      data.status === "complete"
    ) {
      setQuiz(null);
      setQuizScore(data.score);

      let resultText =
        "## Quiz Complete\n\n";

      resultText +=
        `**Score:** ${data.score}/${data.total}\n\n`;

      resultText +=
        `**Percentage:** ${data.percentage}%\n\n`;

      resultText +=
        "### Results\n\n";

      if (
        Array.isArray(data.results)
      ) {
        data.results.forEach(
          (result: any) => {
            resultText +=
              `- Question ${result.question}: ${result.status}\n`;
          }
        );
      }

      resultText +=
        "\n### Incorrect Answers\n\n";

      if (
        Array.isArray(
          data.incorrect_answers
        ) &&
        data.incorrect_answers.length > 0
      ) {
        data.incorrect_answers.forEach(
          (item: any) => {
            resultText +=
              `**Question ${item.question}**\n\n`;

            resultText +=
              `- Your answer: ${item.selected}\n`;

            resultText +=
              `- Correct answer: ${item.correct}\n`;

            resultText +=
              `- Explanation: ${item.explanation}\n\n`;
          }
        );
      } else {
        resultText +=
          "Perfect score. You got all 5 questions correct.";
      }

      addAIMessage(resultText);

      return;
    }

    // =======================================
    // WAITING FOR ANSWER
    // =======================================

    if (
      data.type === "quiz" &&
      data.status ===
        "waiting_for_answer"
    ) {
      setQuizFeedback(
        data.message ||
          "Please answer with A, B, C, or D."
      );

      return;
    }

    // =======================================
    // UNKNOWN RESPONSE
    // =======================================

    if (
      typeof data.reply === "string"
    ) {
      addAIMessage(data.reply);

      return;
    }

    if (
      typeof data.message === "string"
    ) {
      addAIMessage(data.message);

      return;
    }

    throw new Error(
      "Unknown response received from StudyAI backend."
    );
  }

  // =========================================
  // SEND MESSAGE
  // =========================================

  async function handleSend(
    prompt?: string
  ) {
    const userMessage = (
      prompt ?? input
    ).trim();

    if (
      userMessage === "" ||
      loading
    ) {
      return;
    }

    const previousMessages = [
      ...messages,
    ];

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
        "http://127.0.0.1:8000/study-ai",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            message: userMessage,
            history: previousMessages,
            session_id: sessionId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Backend request failed: ${response.status}`
        );
      }

      const data =
        await response.json();

      handleBackendResponse(data);
    } catch (error) {
      console.error(
        "StudyAI Error:",
        error
      );

      addAIMessage(
        "Sorry, I couldn't connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // QUIZ ANSWER
  // =========================================

  async function handleQuizAnswer(
    answer: "A" | "B" | "C" | "D"
  ) {
    if (
      loading ||
      !quiz
    ) {
      return;
    }

    setLoading(true);

    try {
      const previousMessages = [
        ...messages,
      ];

      const response = await fetch(
        "http://127.0.0.1:8000/study-ai",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            message: answer,
            history: previousMessages,
            session_id: sessionId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Quiz request failed: ${response.status}`
        );
      }

      const data =
        await response.json();

      handleBackendResponse(data);
    } catch (error) {
      console.error(
        "Quiz answer error:",
        error
      );

      setQuizFeedback(
        "Sorry, something went wrong while checking your answer."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // QUIZ MODE
  // =========================================

  function handleQuizMode() {
    if (loading) {
      return;
    }

    const quizPrompt =
      "Start a quiz. First ask me which subject or topic I want to be tested on.";

    handleSend(quizPrompt);
  }

  // =========================================
  // STUDY PLAN MODE
  // =========================================

  function handleStudyPlan() {
    if (loading) {
      return;
    }

    const studyPlanPrompt =
      "Create a personalized study plan for me. First ask me what subject or topic I want to study, my current level, how many days I have, and how many hours I can study each day. Then create a practical day-by-day study plan.";

    handleSend(studyPlanPrompt);
  }

  // =========================================
  // UI
  // =========================================

  return (
    <>
      <section className="study-page">

        {/* HEADER */}

        <div className="study-header">

          <div className="study-brand">

            <div className="study-icon">
              AI
            </div>

            <div>
              <h1>StudyAI</h1>

              <div className="study-status">
                <span></span>
                AI Study Assistant
              </div>
            </div>

          </div>

          <p>
            Your personal AI study assistant.
          </p>

          <button
            className="clear-chat-btn"
            onClick={
              handleClearChat
            }
            disabled={
              messages.length === 0 ||
              loading
            }
            type="button"
          >
            Clear Chat
          </button>

        </div>

        {/* CHAT */}

        <div className="study-chat-container">

          <div
            className="study-chat-messages"
            ref={
              chatMessagesRef
            }
          >

            {/* EMPTY STATE */}

            {messages.length === 0 &&
              !quiz && (
                <div className="ai-message">

                  Hi! I'm StudyAI. How can I help you study today?

                  <div className="suggested-prompts">

                    <p>
                      Try asking StudyAI:
                    </p>

                    <div className="prompt-list">

                      <button
                        onClick={() =>
                          handleSend(
                            "Create a study plan for me"
                          )
                        }
                        disabled={loading}
                        type="button"
                      >
                        Create a study plan
                      </button>

                      <button
                        onClick={() =>
                          handleSend(
                            "Explain this topic in simple terms"
                          )
                        }
                        disabled={loading}
                        type="button"
                      >
                        Explain a topic
                      </button>

                      <button
                        onClick={() =>
                          handleSend(
                            "Give me practice questions"
                          )
                        }
                        disabled={loading}
                        type="button"
                      >
                        Practice questions
                      </button>

                      <button
                        onClick={
                          handleQuizMode
                        }
                        disabled={loading}
                        type="button"
                      >
                        Quiz Mode
                      </button>

                      <button
                        onClick={
                          handleStudyPlan
                        }
                        disabled={loading}
                        type="button"
                      >
                        Study Plan
                      </button>

                    </div>

                  </div>

                </div>
              )}

            {/* MESSAGES */}

            {messages.map(
              (
                message,
                index
              ) => (
                <div
                  key={`${message.sender}-${index}`}
                  className={
                    message.sender ===
                    "user"
                      ? "user-message"
                      : "ai-message"
                  }
                >

                  {message.sender ===
                  "ai" ? (
                    <ReactMarkdown
                      components={
                        markdownComponents
                      }
                    >
                      {
                        message.text
                      }
                    </ReactMarkdown>
                  ) : (
                    message.text
                  )}

                </div>
              )
            )}

            {/* QUIZ */}

            {quiz && (
              <div className="ai-message quiz-container">
               <div className="quiz-header">
  <strong>
    {quiz.topic}
  </strong>

  <span>
    Question {quiz.question_number}/{quiz.total_questions}
  </span>
</div>
                

                <div className="quiz-question">
                  {quiz.question}
                </div>

                <div className="quiz-options">

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      handleQuizAnswer(
                        "A"
                      )
                    }
                  >
                    <strong>
                      A)
                    </strong>{" "}
                    {quiz.options.A}
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      handleQuizAnswer(
                        "B"
                      )
                    }
                  >
                    <strong>
                      B)
                    </strong>{" "}
                    {quiz.options.B}
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      handleQuizAnswer(
                        "C"
                      )
                    }
                  >
                    <strong>
                      C)
                    </strong>{" "}
                    {quiz.options.C}
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      handleQuizAnswer(
                        "D"
                      )
                    }
                  >
                    <strong>
                      D)
                    </strong>{" "}
                    {quiz.options.D}
                  </button>

                </div>

                {quizFeedback && (
                  <div className="quiz-feedback">
                    {quizFeedback}
                  </div>
                )}

                {quizScore !== null && (
                  <div className="quiz-score">
                    Current Score:{" "}
                    {quizScore}
                  </div>
                )}

              </div>
            )}

            {/* TYPING INDICATOR */}

            {loading && (
              <div className="ai-message typing-message">

                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>

              </div>
            )}

          </div>

          {/* INPUT */}

          <div className="study-chat-input">

            <input
              type="text"
              placeholder={
                quiz
                  ? "Choose an option above..."
                  : "Ask StudyAI anything..."
              }
              value={input}
              onChange={(e) =>
                setInput(
                  e.target.value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey
                ) {
                  e.preventDefault();

                  handleSend();
                }
              }}
              disabled={
                loading ||
                Boolean(quiz)
              }
            />

            <button
              onClick={() =>
                handleSend()
              }
              disabled={
                loading ||
                input.trim() === "" ||
                Boolean(quiz)
              }
              type="button"
            >
              {loading
                ? "Sending..."
                : "Send"}
            </button>

          </div>

        </div>

      </section>

      <Footer />
    </>
  );
}

export default StudyAI;