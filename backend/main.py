from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq
import os

load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)

app = FastAPI(
    title="AgentVerse AI",
    description="One Platform. Infinite AI Agents.",
    version="0.1.0"
)

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


class Message(BaseModel):
    text: str
    sender: str


class TailorRequest(BaseModel):
    message: str
    history: list[Message] = []


@app.get("/")
def root():
    return {
        "message": "🚀 Welcome to AgentVerse AI",
        "status": "Backend is running successfully!"
    }


@app.get("/health")
def health():
    return {
        "status": "Healthy",
        "service": "AgentVerse AI Backend"
    }


@app.post("/tailor-ai")
def tailor_ai(request: TailorRequest):

    messages = [
        {
            "role": "system",
            "content": (
                "You are TailorAI, an expert AI career assistant for students "
                "and fresh graduates.\n\n"

                "Your job is to provide practical, personalized career guidance "
                "for software and technology careers.\n\n"

                "You can help with:\n"
                "- Career roadmaps\n"
                "- Programming and technical skills\n"
                "- Projects and GitHub portfolios\n"
                "- Resume and LinkedIn improvement\n"
                "- Interview preparation\n"
                "- Job and placement preparation\n"
                "- Learning plans and study schedules\n\n"

                "Rules:\n"
                "1. Give clear and practical advice.\n"
                "2. Break complex topics into simple steps.\n"
                "3. Prefer structured answers with headings and bullet points.\n"
                "4. Avoid unnecessary information.\n"
                "5. When giving a roadmap, organize it in a logical order.\n"
                "6. Ask a clarifying question when the user's goal is unclear.\n"
                "7. Encourage the user, but remain realistic about skills, "
                "time, and job requirements."
            )
        }
    ]

    # Add previous conversation to the AI context
    for message in request.history:
        messages.append({
            "role": "user" if message.sender == "user" else "assistant",
            "content": message.text
        })

    # Add the current user message
    messages.append({
        "role": "user",
        "content": request.message
    })

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.7,
        max_tokens=500
    )

    return {
        "reply": response.choices[0].message.content
    }