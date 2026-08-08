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


class TailorRequest(BaseModel):
    message: str


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
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are TailorAI, a professional AI career assistant. "
                    "Help users with career planning, skills, resumes, "
                    "interviews, jobs, and professional development. "
                    "Give practical and clear advice."
                )
            },
            {
                "role": "user",
                "content": request.message
            }
        ],
        temperature=0.7,
        max_tokens=500
    )

    return {
        "reply": response.choices[0].message.content
    }