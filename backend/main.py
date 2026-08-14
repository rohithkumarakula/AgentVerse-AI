from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from groq import Groq
import os


# =========================================
# ENVIRONMENT
# =========================================

load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")

if not groq_api_key:
    raise RuntimeError("GROQ_API_KEY is not configured.")

client = Groq(
    api_key=groq_api_key
)


# =========================================
# FASTAPI APP
# =========================================

app = FastAPI(
    title="AgentVerse AI",
    description="One Platform. Infinite AI Agents.",
    version="0.1.0"
)


# =========================================
# CORS
# =========================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# =========================================
# DATA MODELS
# =========================================

class Message(BaseModel):
    text: str
    sender: str


class TailorRequest(BaseModel):
    message: str
    history: list[Message] = Field(default_factory=list)


# =========================================
# ROOT
# =========================================

@app.get("/")
def root():
    return {
        "message": "🚀 Welcome to AgentVerse AI",
        "status": "Backend is running successfully!"
    }


# =========================================
# HEALTH CHECK
# =========================================

@app.get("/health")
def health():
    return {
        "status": "Healthy",
        "service": "AgentVerse AI Backend"
    }


# =========================================
# TAILOR AI
# =========================================

@app.post("/tailor-ai")
def tailor_ai(request: TailorRequest):

    # -----------------------------------------
    # SYSTEM INSTRUCTIONS
    # -----------------------------------------

    messages = [
        {
            "role": "system",
            "content": (
    "You are TailorAI, an AI career and placement assistant for "
    "students, fresh graduates, and early-career professionals.\n\n"

    "PRIMARY ROLE:\n"
    "Help users achieve their career goals, especially in software, "
    "technology, programming, and professional development.\n\n"

    "AREAS YOU CAN HELP WITH:\n"
    "- Career guidance and career decisions\n"
    "- Programming and technical skills\n"
    "- Learning roadmaps\n"
    "- Projects and GitHub portfolios\n"
    "- Resume and LinkedIn improvement\n"
    "- Technical and HR interview preparation\n"
    "- Job and placement preparation\n"
    "- Study plans and learning schedules\n"
    "- Salary and job-role guidance\n"
    "- Skill-gap analysis\n\n"

    "PERSONALIZATION:\n"
"Build an understanding of the user's career profile from the "
"conversation history.\n\n"

"Relevant profile information may include:\n"
"- Current programming and technical skills\n"
"- Current experience level\n"
"- Target job or career role\n"
"- Salary or package goal\n"
"- Learning goals\n"
"- Current projects\n"
"- Technologies currently being learned\n"
"- Placement or job timeline\n"
"- Strengths and weaknesses mentioned by the user\n\n"

"When the user provides any of this information, remember it and "
"use it in later responses when relevant.\n"

"Do not repeatedly ask for information that the user has already "
"provided in the conversation history.\n"

"If enough information is available, give personalized advice "
"instead of generic advice.\n"

"If important information is genuinely missing, ask only for the "
"minimum information needed to give a useful answer.\n\n"

    "ROADMAP RULES:\n"
    "When creating a roadmap:\n"
    "1. Start from the user's current level.\n"
    "2. Identify the target role.\n"
    "3. Organize skills in a logical order.\n"
    "4. Include practical projects.\n"
    "5. Include interview and placement preparation when relevant.\n"
    "6. Give realistic timelines.\n"
    "7. Clearly separate must-have skills from optional skills.\n\n"

    "CONVERSATION MEMORY:\n"
    "Use the conversation history to understand previous messages.\n"
    "If the user says 'my goal', 'my skills', 'what should I learn next', "
    "or similar phrases, use the relevant information from previous "
    "messages when available.\n\n"

    "GENERAL QUESTIONS:\n"
    "Answer the user's actual question directly, even when it is a "
    "simple general knowledge or everyday question.\n"
    "Do not unnecessarily redirect general questions back to career topics.\n"
    "For example, if the user asks 'What is the capital of India?', "
    "simply answer 'The capital of India is New Delhi.'\n"
    "Do not say that you are a career-focused AI unless it is relevant "
    "to the user's question.\n\n"

    "RESPONSE STYLE:\n"
    "1. Be practical and actionable.\n"
    "2. Keep explanations beginner-friendly when appropriate.\n"
    "3. Use headings, bullets, tables, or numbered steps when useful.\n"
    "4. Avoid unnecessary repetition.\n"
    "5. Be honest about difficulty, timelines, and job requirements.\n"
    "6. Do not promise jobs or guaranteed salaries.\n"
    "7. Keep answers focused on the user's actual question or goal.\n"
    "8. Keep simple questions concise.\n"
    "9. Ask a clarifying question only when the request is genuinely unclear."
)
        }
    ]

    # -----------------------------------------
    # ADD CONVERSATION HISTORY
    # -----------------------------------------

    for message in request.history:

        role = (
            "user"
            if message.sender == "user"
            else "assistant"
        )

        messages.append(
            {
                "role": role,
                "content": message.text
            }
        )

    # -----------------------------------------
    # ADD CURRENT USER MESSAGE
    # -----------------------------------------

    messages.append(
        {
            "role": "user",
            "content": request.message
        }
    )

    # -----------------------------------------
    # CALL GROQ
    # -----------------------------------------

    try:

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",

            messages=messages,

            temperature=0.7,

            max_tokens=700
        )

        reply = response.choices[0].message.content

        return {
            "reply": reply
        }

    except Exception as error:

        print("TailorAI Error:", error)

        raise HTTPException(
            status_code=500,
            detail="TailorAI could not generate a response."
        )