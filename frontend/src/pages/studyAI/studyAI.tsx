import "./studyAI.css";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import Footer from "../../components/Footer/Footer";

type Message = {
  text: string;
  sender: "user" | "ai";
};

type QuizQuestion = {
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

  selectedAnswer?: "A" | "B" | "C" | "D";
  correctAnswer?: string;
  feedback?: string;
  explanation?: string;

  answered: boolean;
};

type QuizResult = {
  score: number;
  total: number;
  percentage: number;

  results: Array<{
    question: number;
    status: string;
  }>;

  incorrectAnswers: Array<{
    question: number;
    selected: string;
    correct: string;
    explanation: string;
  }>;
};

const CHAT_STORAGE_KEY = "agentverse-study-chat";
const SESSION_STORAGE_KEY = "agentverse-study-session";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

const STUDY_AI_URL = `${API_BASE_URL}/study-ai`;

function getSessionId(): string {
  const existingSessionId = localStorage.getItem(
    SESSION_STORAGE_KEY
  );

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
    const savedChat = localStorage.getItem(
      CHAT_STORAGE_KEY
    );

    if (!savedChat) {
      return [];
    }

    try {
      const parsed = JSON.parse(savedChat);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(
        (message): message is Message =>
          message &&
          typeof message === "object" &&
          typeof message.text === "string" &&
          (message.sender === "user" ||
            message.sender === "ai")
      );
    } catch (error) {
      console.error(
        "StudyAI chat history parsing failed:",
        error
      );

      localStorage.removeItem(
        CHAT_STORAGE_KEY
      );

      return [];
    }
  });

  const [loading, setLoading] = useState(false);

  const [copiedCode, setCopiedCode] =
    useState("");

  /*
   * Store every quiz question.
   */
  const [quizQuestions, setQuizQuestions] =
    useState<QuizQuestion[]>([]);

  const [quizScore, setQuizScore] =
    useState<number | null>(null);

  const [quizTopic, setQuizTopic] =
    useState("");

  /*
   * Quiz result is stored separately from
   * normal chat messages.
   */
  const [quizResult, setQuizResult] =
    useState<QuizResult | null>(null);

  const chatMessagesRef =
    useRef<HTMLDivElement>(null);

  const sessionId = getSessionId();

  // =========================================
  // SAVE CHAT
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
    const chat =
      chatMessagesRef.current;

    if (!chat) {
      return;
    }

    requestAnimationFrame(() => {
      chat.scrollTo({
        top: chat.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [
    messages,
    quizQuestions,
    quizResult,
    loading,
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

    setQuizQuestions([]);
    setQuizScore(null);
    setQuizTopic("");
    setQuizResult(null);

    localStorage.removeItem(
      CHAT_STORAGE_KEY
    );

    const newSessionId =
      crypto.randomUUID();

    localStorage.setItem(
      SESSION_STORAGE_KEY,
      newSessionId
    );
  }

  // =========================================
  // MARKDOWN
  // =========================================

  const markdownComponents: Components = {
    code({
      className,
      children,
      ...props
    }) {
      const code = String(children).replace(
        /\n$/,
        ""
      );

      const isCodeBlock =
        Boolean(className);

      /*
       * Inline code
       */
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

      /*
       * Code block
       */
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
  // ADD QUIZ QUESTION
  // =========================================

  function addQuizQuestion(data: any) {
    if (
      !data ||
      !data.question ||
      !data.options
    ) {
      return;
    }

    const newQuestion: QuizQuestion = {
      quiz_id: String(
        data.quiz_id || ""
      ),

      topic: String(
        data.topic ||
        quizTopic ||
        "Quiz"
      ),

      question_number:
        Number(
          data.question_number
        ),

      total_questions:
        Number(
          data.total_questions
        ),

      question:
        String(data.question),

      options: {
        A: String(
          data.options.A ?? ""
        ),

        B: String(
          data.options.B ?? ""
        ),

        C: String(
          data.options.C ?? ""
        ),

        D: String(
          data.options.D ?? ""
        ),
      },

      answered: false,
    };

    setQuizTopic(
      String(
        data.topic ||
        quizTopic ||
        "Quiz"
      )
    );

    /*
     * Do not replace previous questions.
     * Add each question only once.
     */
    setQuizQuestions((prev) => {
      const alreadyExists =
        prev.some(
          (question) =>
            question.quiz_id ===
            newQuestion.quiz_id &&
            question.question_number ===
            newQuestion.question_number
        );

      if (alreadyExists) {
        return prev;
      }

      return [
        ...prev,
        newQuestion,
      ].sort(
        (a, b) =>
          a.question_number -
          b.question_number
      );
    });
  }

  // =========================================
  // UPDATE ANSWERED QUESTION
  // =========================================

  function updateQuizQuestion(
    questionNumber: number,
    answer: "A" | "B" | "C" | "D",
    correctAnswer: string,
    feedback: string,
    explanation: string
  ) {
    setQuizQuestions((prev) =>
      prev.map((question) =>
        question.question_number ===
          questionNumber
          ? {
            ...question,
            selectedAnswer:
              answer,
            correctAnswer,
            feedback,
            explanation,
            answered: true,
          }
          : question
      )
    );
  }

  // =========================================
  // BACKEND RESPONSE
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
    // NORMAL RESPONSE
    // =======================================

    if (data.type === "normal") {
      if (
        typeof data.reply !==
        "string"
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
      setQuizQuestions([]);
      setQuizScore(null);
      setQuizResult(null);

      if (
        typeof data.message ===
        "string"
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
      addQuizQuestion(data);

      return;
    }

    // =======================================
    // ANSWER RECEIVED
    // =======================================

    if (
      data.type === "quiz" &&
      data.status ===
      "answer_received"
    ) {
      const questionNumber =
        Number(
          data.question_number
        );

      const selectedAnswer =
        data.selected_answer as
        | "A"
        | "B"
        | "C"
        | "D";

      const correctAnswer =
        String(
          data.correct_answer ||
          ""
        );

      const feedback = data.correct
        ? `Correct! The answer is ${correctAnswer}.`
        : `Incorrect. You selected ${selectedAnswer}, but the correct answer is ${correctAnswer}.`;

      const explanation =
        typeof data.explanation ===
          "string"
          ? data.explanation
          : "";

      updateQuizQuestion(
        questionNumber,
        selectedAnswer,
        correctAnswer,
        feedback,
        explanation
      );

      if (
        typeof data.score ===
        "number"
      ) {
        setQuizScore(
          data.score
        );
      }

      /*
       * If backend sends the next question
       * together with answer_received,
       * add it.
       */
      if (
        data.question &&
        data.options
      ) {
        addQuizQuestion(data);
      }

      return;
    }

    // =======================================
    // QUIZ COMPLETE
    // =======================================

    if (
      data.type === "quiz" &&
      data.status === "complete"
    ) {
      const score =
        typeof data.score ===
          "number"
          ? data.score
          : 0;

      const total =
        typeof data.total ===
          "number"
          ? data.total
          : 5;

      const percentage =
        typeof data.percentage ===
          "number"
          ? data.percentage
          : total > 0
            ? Math.round(
              (score / total) *
              100
            )
            : 0;

      setQuizScore(score);

      /*
       * Store the final result separately.
       * It will render below all questions.
       */

      const results =
        Array.isArray(
          data.results
        )
          ? data.results.map(
            (result: any) => ({
              question:
                Number(
                  result.question
                ),

              status:
                String(
                  result.status
                ),
            })
          )
          : [];

      const incorrectAnswers =
        Array.isArray(
          data.incorrect_answers
        )
          ? data.incorrect_answers.map(
            (item: any) => ({
              question:
                Number(
                  item.question
                ),

              selected:
                String(
                  item.selected ??
                  "-"
                ),

              correct:
                String(
                  item.correct ??
                  "-"
                ),

              explanation:
                String(
                  item.explanation ??
                  ""
                ),
            })
          )
          : [];

      setQuizResult({
        score,
        total,
        percentage,
        results,
        incorrectAnswers,
      });

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
      addAIMessage(
        data.message ||
        "Please answer with A, B, C, or D."
      );

      return;
    }

    // =======================================
    // FALLBACK
    // =======================================

    if (
      typeof data.reply ===
      "string"
    ) {
      addAIMessage(data.reply);

      return;
    }

    if (
      typeof data.message ===
      "string"
    ) {
      addAIMessage(
        data.message
      );

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
        STUDY_AI_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            message:
              userMessage,

            history:
              previousMessages,

            session_id:
              sessionId,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage =
          `Backend request failed: ${response.status}`;

        try {
          const errorData =
            await response.json();

          if (
            errorData?.detail
          ) {
            errorMessage =
              errorData.detail;
          }
        } catch {
          // Ignore JSON parsing error
        }

        throw new Error(
          errorMessage
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
        error instanceof Error
          ? `Sorry, ${error.message}`
          : "Sorry, I couldn't connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================
  // QUIZ ANSWER
  // =========================================

  async function handleQuizAnswer(
    question: QuizQuestion,
    answer:
      | "A"
      | "B"
      | "C"
      | "D"
  ) {
    if (
      loading ||
      question.answered
    ) {
      return;
    }

    setLoading(true);

    try {
      const previousMessages = [
        ...messages,
      ];

      const response = await fetch(
        STUDY_AI_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            message: answer,

            history:
              previousMessages,

            session_id:
              sessionId,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage =
          `Quiz request failed: ${response.status}`;

        try {
          const errorData =
            await response.json();

          if (
            errorData?.detail
          ) {
            errorMessage =
              errorData.detail;
          }
        } catch {
          // Ignore
        }

        throw new Error(
          errorMessage
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

      addAIMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while checking your answer."
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

    setQuizQuestions([]);
    setQuizScore(null);
    setQuizTopic("");
    setQuizResult(null);

    handleSend(
      "Start a quiz. Ask me which subject or topic I want to be tested on. Create exactly 5 different multiple-choice questions. Do not repeat questions. Each question must have four options A, B, C, and D."
    );
  }

  // =========================================
  // STUDY PLAN
  // =========================================

  function handleStudyPlan() {
    if (loading) {
      return;
    }

    handleSend(
      "Create a personalized study plan for me. First ask me what subject or topic I want to study, my current level, how many days I have, and how many hours I can study each day. Then create a practical day-by-day study plan."
    );
  }

  // =========================================
  // CHECK ACTIVE QUESTION
  // =========================================

  const hasUnansweredQuestion =
    quizQuestions.some(
      (question) =>
        !question.answered
    );

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

            <div className="study-brand-text">

              <h1>
                StudyAI
              </h1>

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
              (
                messages.length ===
                0 &&
                quizQuestions.length ===
                0 &&
                quizResult === null
              ) ||
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

            {messages.length ===
              0 &&
              quizQuestions.length ===
              0 &&
              quizResult ===
              null && (

                <div className="ai-message">

                  <div className="ai-markdown">
                    Hi! I'm StudyAI. How can I help you study today?
                  </div>

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
                        disabled={
                          loading
                        }
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
                        disabled={
                          loading
                        }
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
                        disabled={
                          loading
                        }
                        type="button"
                      >
                        Practice questions
                      </button>

                      <button
                        onClick={
                          handleQuizMode
                        }
                        disabled={
                          loading
                        }
                        type="button"
                      >
                        Quiz Mode
                      </button>

                      <button
                        onClick={
                          handleStudyPlan
                        }
                        disabled={
                          loading
                        }
                        type="button"
                      >
                        Study Plan
                      </button>

                    </div>

                  </div>

                </div>
              )}

            {/* NORMAL MESSAGES */}

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

                    /*
                     * IMPORTANT:
                     * Wrapper allows CSS to control
                     * Markdown alignment without
                     * affecting the whole message.
                     */

                    <div className="ai-markdown">

                      <ReactMarkdown
                        remarkPlugins={[
                          remarkGfm,
                        ]}
                        components={
                          markdownComponents
                        }
                      >
                        {
                          message.text
                        }
                      </ReactMarkdown>

                    </div>

                  ) : (
                    message.text
                  )}

                </div>
              )
            )}

            {/* =====================================
                QUIZ QUESTIONS
                ===================================== */}

            {quizQuestions.length >
              0 && (

                <div className="quiz-container">

                  {/* QUIZ HEADER */}

                  <div className="quiz-main-header">

                    <div>

                      <span className="quiz-label">
                        QUIZ MODE
                      </span>

                      <h2>
                        {quizTopic}
                      </h2>

                    </div>

                    <div className="quiz-progress">
                      {
                        quizQuestions.length
                      }{" "}
                      / 5 questions
                    </div>

                  </div>

                  {/* QUESTIONS */}

                  {quizQuestions.map(
                    (
                      question
                    ) => (

                      <div
                        key={`${question.quiz_id}-${question.question_number}`}
                        className={`quiz-question-card ${question.answered
                            ? "quiz-question-answered"
                            : "quiz-question-active"
                          }`}
                      >

                        {/* QUESTION HEADER */}

                        <div className="quiz-question-top">

                          <span className="quiz-question-number">
                            Question{" "}
                            {
                              question.question_number
                            }
                          </span>

                          <span className="quiz-total">
                            {" "}
                            /{" "}
                            {
                              question.total_questions
                            }
                          </span>

                        </div>

                        {/* QUESTION */}

                        <div className="quiz-question-text">
                          {
                            question.question
                          }
                        </div>

                        {/* OPTIONS */}

                        <div className="quiz-options">

                          {(
                            [
                              "A",
                              "B",
                              "C",
                              "D",
                            ] as const
                          ).map(
                            (
                              option
                            ) => {

                              const isSelected =
                                question.selectedAnswer ===
                                option;

                              return (

                                <button
                                  key={
                                    option
                                  }
                                  type="button"
                                  disabled={
                                    loading ||
                                    question.answered
                                  }
                                  className={
                                    isSelected
                                      ? "quiz-option selected"
                                      : "quiz-option"
                                  }
                                  onClick={() =>
                                    handleQuizAnswer(
                                      question,
                                      option
                                    )
                                  }
                                >

                                  <span className="quiz-option-letter">
                                    {option})
                                  </span>

                                  <span className="quiz-option-text">
                                    {
                                      question
                                        .options[
                                      option
                                      ]
                                    }
                                  </span>

                                </button>

                              );
                            }
                          )}

                        </div>

                        {/* FEEDBACK */}

                        {question.answered &&
                          question.feedback && (

                            <div className="quiz-feedback">

                              <strong>
                                {
                                  question.feedback
                                }
                              </strong>

                              {question.explanation && (
                                <p>
                                  {
                                    question.explanation
                                  }
                                </p>
                              )}

                            </div>

                          )}

                      </div>

                    )
                  )}

                  {/* =================================
                    FINAL QUIZ RESULT
                    ================================= */}

                  {quizResult !==
                    null && (

                      <div className="quiz-result-card">

                        <div className="quiz-result-title">
                          🎉 Quiz Complete
                        </div>

                        <div className="quiz-result-divider"></div>

                        <div className="quiz-result-score">

                          <span>
                            Score
                          </span>

                          <strong>
                            {
                              quizResult.score
                            }
                            /
                            {
                              quizResult.total
                            }
                          </strong>

                        </div>

                        <div className="quiz-result-percentage">

                          <span>
                            Percentage
                          </span>

                          <strong>
                            {
                              quizResult.percentage
                            }%
                          </strong>

                        </div>

                        {/* RESULTS */}

                        {quizResult.results.length >
                          0 && (

                            <div className="quiz-result-section">

                              <h3>
                                Results
                              </h3>

                              <div className="quiz-results-list">

                                {quizResult.results.map(
                                  (
                                    result,
                                    index
                                  ) => (

                                    <div
                                      key={`${result.question}-${index}`}
                                      className="quiz-result-row"
                                    >

                                      <span>
                                        Question{" "}
                                        {
                                          result.question
                                        }
                                      </span>

                                      <strong>
                                        {
                                          result.status
                                        }
                                      </strong>

                                    </div>

                                  )
                                )}

                              </div>

                            </div>

                          )}

                        {/* INCORRECT ANSWERS */}

                        <div className="quiz-result-section">

                          <h3>
                            Incorrect Answers
                          </h3>

                          {quizResult
                            .incorrectAnswers
                            .length >
                            0 ? (

                            <div className="quiz-incorrect-list">

                              {quizResult.incorrectAnswers.map(
                                (
                                  item,
                                  index
                                ) => (

                                  <div
                                    key={`${item.question}-${index}`}
                                    className="quiz-incorrect-item"
                                  >

                                    <strong>
                                      Question{" "}
                                      {
                                        item.question
                                      }
                                    </strong>

                                    <p>
                                      <strong>
                                        Your answer:
                                      </strong>{" "}
                                      {
                                        item.selected
                                      }
                                    </p>

                                    <p>
                                      <strong>
                                        Correct answer:
                                      </strong>{" "}
                                      {
                                        item.correct
                                      }
                                    </p>

                                    {item.explanation && (
                                      <p>
                                        <strong>
                                          Explanation:
                                        </strong>{" "}
                                        {
                                          item.explanation
                                        }
                                      </p>
                                    )}

                                  </div>

                                )
                              )}

                            </div>

                          ) : (

                            <div className="quiz-perfect-score">
                              Perfect score! You got all questions correct. 🎯
                            </div>

                          )}

                        </div>

                      </div>

                    )}

                  {/* CURRENT SCORE */}

                  {quizScore !==
                    null &&
                    quizResult ===
                    null && (

                      <div className="quiz-score">

                        <span>
                          Current Score
                        </span>

                        <strong>
                          {
                            quizScore
                          }
                        </strong>

                      </div>

                    )}

                </div>

              )}

            {/* TYPING */}

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
                hasUnansweredQuestion
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
                  e.key ===
                  "Enter" &&
                  !e.shiftKey
                ) {

                  e.preventDefault();

                  handleSend();

                }

              }}
              disabled={
                loading ||
                hasUnansweredQuestion
              }
            />

            <button
              onClick={() =>
                handleSend()
              }
              disabled={
                loading ||
                input.trim() ===
                "" ||
                hasUnansweredQuestion
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