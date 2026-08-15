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


class CareerProfile(BaseModel):
    skills: str
    targetRole: str
    experience: str
    timeline: str
    salaryGoal: str


class TailorRequest(BaseModel):
    message: str
    history: list[Message] = Field(default_factory=list)
    profile: CareerProfile | None = None


# =========================================
# ROOT
# =========================================

@app.get("/")
def root():
    return {
        "message": "Welcome to AgentVerse AI",
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
# CAREER PROFILE
# =========================================

@app.post("/career-profile")
def save_career_profile(profile: CareerProfile):
    return {
        "message": "Career profile received successfully.",
        "profile": profile.model_dump()
    }


# =========================================
# TAILOR AI
# =========================================

@app.post("/tailor-ai")
def tailor_ai(request: TailorRequest):

    # -----------------------------------------
    # SYSTEM INSTRUCTIONS
    # -----------------------------------------

    system_prompt = (
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
        "Use the user's career profile whenever it is provided.\n"
        "Do not ignore the career profile.\n"
        "Use it to personalize recommendations, roadmaps, skill-gap "
        "analysis, project suggestions, interview preparation, and "
        "career advice.\n\n"

        "CAREER PROFILE RULES:\n"
        "The profile may contain:\n"
        "- Current skills\n"
        "- Target role\n"
        "- Experience level\n"
        "- Learning timeline\n"
        "- Target salary\n\n"

        "When a career profile is available, treat it as the user's "
        "current career information.\n"
        "Do not repeatedly ask the user for information already present "
        "in the profile.\n"
        "If the user asks about their career, goals, skills, roadmap, "
        "or what they should learn next, use the profile information "
        "to answer.\n\n"

        "ROADMAP RULES:\n"
        "When creating a roadmap:\n"
        "1. Start from the user's current level.\n"
        "2. Identify the target role.\n"
        "3. Organize skills in a logical order.\n"
        "4. Include practical projects.\n"
        "5. Include interview and placement preparation when relevant.\n"
        "6. Consider the user's timeline.\n"
        "7. Clearly separate must-have skills from optional skills.\n\n"

        "CONVERSATION MEMORY:\n"
        "Use the conversation history to understand previous messages.\n"
        "If the user says 'my goal', 'my skills', 'what should I learn "
        "next', or similar phrases, use the career profile and relevant "
        "conversation history when available.\n\n"

        "GENERAL QUESTIONS:\n"
        "Answer the user's actual question directly, even when it is a "
        "simple general knowledge or everyday question.\n"
        "Do not unnecessarily redirect general questions back to career topics.\n\n"

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

    messages = [
        {
            "role": "system",
            "content": system_prompt
        }
    ]

    # -----------------------------------------
    # ADD CAREER PROFILE
    # -----------------------------------------

    if request.profile:

        profile = request.profile

        profile_context = (
            "\n\nUSER CAREER PROFILE:\n"
            f"Current Skills: {profile.skills}\n"
            f"Target Role: {profile.targetRole}\n"
            f"Experience Level: {profile.experience}\n"
            f"Timeline: {profile.timeline}\n"
            f"Target Salary: {profile.salaryGoal}\n\n"
            "Use this profile when answering the user's current request."
        )

        messages[0]["content"] += profile_context

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