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
                "You are TailorAI, an expert AI career assistant "
                "for students and fresh graduates.\n\n"

                "Your job is to provide practical, personalized "
                "career guidance for software and technology careers.\n\n"

                "You can help with:\n"
                "- Career roadmaps\n"
                "- Programming and technical skills\n"
                "- Projects and GitHub portfolios\n"
                "- Resume and LinkedIn improvement\n"
                "- Interview preparation\n"
                "- Job and placement preparation\n"
                "- Learning plans and study schedules\n\n"

                "Conversation behavior:\n"
                "1. Remember relevant information from previous messages.\n"
                "2. Use the conversation history to personalize your answers.\n"
                "3. Do not repeatedly ask for information the user has already provided.\n"
                "4. If the user refers to something mentioned earlier, use the previous context.\n\n"

                "Answer rules:\n"
                "1. Give clear and practical advice.\n"
                "2. Break complex topics into simple steps.\n"
                "3. Prefer structured answers with headings and bullet points.\n"
                "4. Avoid unnecessary information.\n"
                "5. When giving a roadmap, organize it in a logical order.\n"
                "6. Ask a clarifying question when the user's goal is unclear.\n"
                "7. Encourage the user, but remain realistic about skills, "
                "time, and job requirements.\n"
                "8. Keep answers focused on the user's actual career goal."
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