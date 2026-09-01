from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from groq import Groq
from uuid import uuid4

import json
import re
import os
import base64
import asyncio


# =========================================
# ENVIRONMENT
# =========================================

load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY")

if not groq_api_key:
    raise RuntimeError("GROQ_API_KEY is not configured.")

client = Groq(api_key=groq_api_key)


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
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):(517[0-9]|518[0-9])",
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
    
class CareerAIRequest(BaseModel):
    profile: CareerProfile


class TailorRequest(BaseModel):
    message: str
    history: list[Message] = Field(default_factory=list)
    profile: CareerProfile | None = None


# =========================================
# TAILOR HISTORY LIMITS
# =========================================

# The frontend keeps the complete chat for display/history,
# but the model should receive only a bounded context window.
# These limits also protect the API when an older frontend/client
# sends an unexpectedly large history.
TAILOR_MAX_HISTORY_MESSAGES = 10
TAILOR_MAX_HISTORY_CHARS = 9000
TAILOR_MAX_MESSAGE_CHARS = 2000
TAILOR_REQUEST_TIMEOUT_SECONDS = 75
TAILOR_MAX_OUTPUT_TOKENS = 5000
STUDY_MAX_OUTPUT_TOKENS = 5000
LIFE_MAX_OUTPUT_TOKENS = 4000


def compact_tailor_history(history):
    """Return recent conversation context under a safe character budget."""
    if not isinstance(history, list):
        return []

    result = []
    total_chars = 0

    for item in reversed(history):
        if not isinstance(item, dict):
            continue

        sender = (
            "user"
            if item.get("sender") == "user"
            else "ai"
        )

        text = str(item.get("text") or "").strip()

        attachment = item.get("attachment")
        attachment_meta = None

        if isinstance(attachment, dict):
            attachment_meta = {
                "name": str(
                    attachment.get("name") or "Attachment"
                )[:180],
                "type": str(
                    attachment.get("type")
                    or "application/octet-stream"
                )[:120],
            }

        if not text and not attachment_meta:
            continue

        text = text[:TAILOR_MAX_MESSAGE_CHARS]

        item_size = (
            len(text)
            + len(
                attachment_meta["name"]
                if attachment_meta
                else ""
            )
            + 80
        )

        if (
            result
            and total_chars + item_size
            > TAILOR_MAX_HISTORY_CHARS
        ):
            break

        result.append({
            "text": text,
            "sender": sender,
            "attachment": attachment_meta,
        })

        total_chars += item_size

        if len(result) >= TAILOR_MAX_HISTORY_MESSAGES:
            break

    result.reverse()
    return result


class StudyRequest(BaseModel):
    message: str
    history: list[Message] = Field(default_factory=list)
    session_id: str


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
# CAREER AI
# =========================================

@app.post("/career-ai")
def career_ai(request: CareerAIRequest):

    profile = request.profile

    system_prompt = (
        "You are CareerAI, an expert career planning and "
        "skill-gap analysis assistant.\n\n"

        "Your job is to analyze the user's career profile "
        "and provide practical, personalized career guidance.\n\n"

        "CAREER PROFILE:\n"
        f"Current Skills: {profile.skills}\n"
        f"Target Role: {profile.targetRole}\n"
        f"Experience Level: {profile.experience}\n"
        f"Timeline: {profile.timeline}\n"
        f"Target Salary: {profile.salaryGoal}\n\n"

        "ANALYSIS REQUIREMENTS:\n"
        "1. Assess the user's current position.\n"
        "2. Identify important skills they already have.\n"
        "3. Identify missing skills required for the target role.\n"
        "4. Separate must-have skills from optional skills.\n"
        "5. Create a realistic learning roadmap.\n"
        "6. Recommend practical projects.\n"
        "7. Suggest interview preparation areas.\n"
        "8. Give clear next steps.\n\n"

        "RESPONSE FORMAT:\n"
        "Use clear headings and bullet points.\n"
        "Include these sections:\n"
        "- Career Assessment\n"
        "- Current Strengths\n"
        "- Skill Gaps\n"
        "- Recommended Roadmap\n"
        "- Project Recommendations\n"
        "- Interview Preparation\n"
        "- Next Steps\n\n"

        "RESPONSE STYLE:\n"
        "Be practical, realistic, beginner-friendly, "
        "and personalized to the user's profile.\n"
        "Do not recommend unnecessary technologies."
    )

    try:

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": (
                        "Analyze my career profile and create "
                        "a personalized career plan."
                    )
                }
            ],
            temperature=0.5,
            max_tokens=1500
        )

        reply = response.choices[0].message.content

        return {
            "type": "career-analysis",
            "reply": reply
        }

    except Exception as error:

        print("CareerAI Error:", error)

        raise HTTPException(
            status_code=500,
            detail="CareerAI could not generate a response."
        )

# =========================================
# TAILOR AI
# =========================================

@app.post("/tailor-ai")
async def tailor_ai(request: Request):
    """
    TailorAI supports both:
    1. JSON requests from the normal text chat.
    2. multipart/form-data requests when an image is attached.

    Text-only requests continue using GPT-OSS 120B.
    Image requests use Groq's vision-capable Qwen 3.6 27B model.
    """

    content_type = request.headers.get("content-type", "").lower()

    try:
        # -----------------------------------------
        # READ REQUEST
        # -----------------------------------------

        image_data_url = None

        if "multipart/form-data" in content_type:
            form = await request.form()

            message = str(form.get("message") or "").strip()

            history_raw = form.get("history") or "[]"
            profile_raw = form.get("profile")

            try:
                history_data = json.loads(str(history_raw))
            except json.JSONDecodeError:
                history_data = []

            if not isinstance(history_data, list):
                history_data = []

            profile_data = None
            if profile_raw:
                try:
                    profile_data = json.loads(str(profile_raw))
                except json.JSONDecodeError:
                    profile_data = None

            # Support either "image" or "file" as the frontend field name.
            uploaded_image = form.get("image") or form.get("file")

            if isinstance(uploaded_image, UploadFile):
                if uploaded_image.content_type and not uploaded_image.content_type.startswith("image/"):
                    raise HTTPException(
                        status_code=400,
                        detail="Only image files are supported."
                    )

                image_bytes = await uploaded_image.read()

                # Prevent unnecessarily large requests.
                if len(image_bytes) > 10 * 1024 * 1024:
                    raise HTTPException(
                        status_code=413,
                        detail="Image is too large. Please upload an image under 10 MB."
                    )

                mime_type = uploaded_image.content_type or "image/jpeg"
                encoded_image = base64.b64encode(image_bytes).decode("utf-8")
                image_data_url = f"data:{mime_type};base64,{encoded_image}"

        else:
            # Keep the existing JSON API fully compatible with the current frontend.
            payload = await request.json()
            tailor_request = TailorRequest.model_validate(payload)

            message = tailor_request.message.strip()
            history_data = [item.model_dump() for item in tailor_request.history]
            profile_data = (
                tailor_request.profile.model_dump()
                if tailor_request.profile
                else None
            )

        if not message:
            raise HTTPException(
                status_code=400,
                detail="Please enter a message."
            )

        # -----------------------------------------
        # PROTECT THE MODEL FROM LONG CHATS
        # -----------------------------------------

        history_data = compact_tailor_history(
            history_data
        )

        # -----------------------------------------
        # SYSTEM PROMPT
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
            "1. Answer the user's exact question first.\n"
            "2. Be practical, direct, and beginner-friendly when appropriate.\n"
            "3. Prefer short paragraphs, clear headings, bullets, numbered steps, and small tables.\n"
            "4. Use Markdown formatting consistently so the answer is easy to scan.\n"
            "5. Do not write one giant paragraph. Break information into logical sections.\n"
            "6. Do not repeat the same point in different words.\n"
            "7. For simple questions, answer briefly (usually 3-8 sentences).\n"
            "8. For normal questions, aim for roughly 250-500 words unless more detail is genuinely necessary.\n"
            "9. Only give a long answer when the user asks for detail or the topic truly requires it.\n"
            "10. Put the most important answer near the top.\n"
            "11. For comparisons, use a compact Markdown table when it improves clarity.\n"
            "12. For roadmaps, use numbered phases or weeks instead of long prose.\n"
            "13. For code, explain briefly and keep code in fenced code blocks.\n"
            "14. Be honest about difficulty, timelines, and job requirements.\n"
            "15. Do not promise jobs or guaranteed salaries.\n"
            "16. Ask a clarifying question only when the request is genuinely unclear."
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

        if profile_data:
            profile = profile_data

            profile_context = (
                "\n\nUSER CAREER PROFILE:\n"
                f"Current Skills: {profile.get('skills', '')}\n"
                f"Target Role: {profile.get('targetRole', '')}\n"
                f"Experience Level: {profile.get('experience', '')}\n"
                f"Timeline: {profile.get('timeline', '')}\n"
                f"Target Salary: {profile.get('salaryGoal', '')}\n\n"
                "Use this profile when answering the user's current request."
            )

            messages[0]["content"] += profile_context

        # -----------------------------------------
        # ADD HISTORY
        # -----------------------------------------

        for history_message in history_data:
            if not isinstance(history_message, dict):
                continue

            role = (
                "user"
                if history_message.get("sender") == "user"
                else "assistant"
            )

            text = str(history_message.get("text") or "")

            if text:
                messages.append(
                    {
                        "role": role,
                        "content": text
                    }
                )

        # -----------------------------------------
        # CURRENT MESSAGE
        # -----------------------------------------

        if image_data_url:
            # Groq vision models accept a multimodal content array.
            current_content = [
                {
                    "type": "text",
                    "text": message
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_data_url
                    }
                }
            ]
        else:
            current_content = message

        messages.append(
            {
                "role": "user",
                "content": current_content
            }
        )

        # -----------------------------------------
        # CALL GROQ
        # -----------------------------------------

        model = (
            "qwen/qwen3.6-27b"
            if image_data_url
            else "openai/gpt-oss-120b"
        )

        # Groq's Python client is synchronous. Run it in a worker thread so
        # FastAPI's event loop is not blocked while the model is generating.
        # A timeout also prevents the browser from appearing frozen forever.
        def generate_response():
            return client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.5,
                max_tokens=TAILOR_MAX_OUTPUT_TOKENS
            )

        try:
            response = await asyncio.wait_for(
                asyncio.to_thread(generate_response),
                timeout=TAILOR_REQUEST_TIMEOUT_SECONDS
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=504,
                detail=(
                    "TailorAI took too long to respond. "
                    "Please try the question again or make it shorter."
                )
            )

        choice = response.choices[0]
        reply = choice.message.content or ""
        finish_reason = getattr(choice, "finish_reason", None)

        return {
            "reply": reply,
            "has_image": bool(image_data_url),
            "truncated": finish_reason == "length"
        }

    except HTTPException:
        raise

    except Exception as error:
        print("TailorAI Error:", repr(error))

        raise HTTPException(
            status_code=500,
            detail="TailorAI could not generate a response."
        )


# =========================================
# QUIZ STATE
# =========================================

quiz_sessions = {}
pending_quiz_topics = {}


# =========================================
# QUIZ VALIDATION
# =========================================

def validate_quiz(quiz):

    if not isinstance(quiz, dict):
        return False

    questions = quiz.get("questions")

    if not isinstance(questions, list):
        return False

    if len(questions) != 5:
        return False

    required_options = {"A", "B", "C", "D"}

    for question in questions:

        if not isinstance(question, dict):
            return False

        question_text = question.get("question")

        if not isinstance(question_text, str):
            return False

        if not question_text.strip():
            return False

        options = question.get("options")

        if not isinstance(options, dict):
            return False

        if set(options.keys()) != required_options:
            return False

        for option in ["A", "B", "C", "D"]:

            if not isinstance(options[option], str):
                return False

            if not options[option].strip():
                return False

        correct_answer = question.get("correct_answer")

        if correct_answer not in ["A", "B", "C", "D"]:
            return False

        explanation = question.get("explanation")

        if not isinstance(explanation, str):
            return False

        if not explanation.strip():
            return False

    return True


# =========================================
# CLEAN JSON
# =========================================

def clean_json_response(content: str):

    content = content.strip()

    content = re.sub(
        r"^```json\s*",
        "",
        content,
        flags=re.IGNORECASE
    )

    content = re.sub(
        r"\s*```$",
        "",
        content
    )

    return content.strip()


# =========================================
# GENERATE RAW QUIZ
# =========================================

def generate_raw_quiz(topic: str):

    prompt = f"""
Create exactly ONE high-quality 5-question multiple-choice quiz.

REQUESTED TOPIC:
{topic}

IMPORTANT:

Every question MUST be specifically about the requested topic.

The quiz is for students, so accuracy is more important than creativity.

You MUST independently solve every question before returning the JSON.

FOR EACH QUESTION:

1. Write a clear and unambiguous question.
2. Write exactly four options: A, B, C and D.
3. Determine the correct answer independently.
4. Make sure the correct answer is actually contained in the selected option.
5. Set correct_answer to the correct option letter.
6. Write an explanation that explains THAT EXACT question.
7. Do not use an explanation belonging to another question.
8. Do not create ambiguous questions.
9. Avoid questions where multiple options could reasonably be correct.
10. Avoid subjective questions.
11. Prefer well-established textbook facts.
12. Do not guess.

ANSWER DISTRIBUTION:

Distribute correct answers naturally across A, B, C and D.

Do not make every correct answer the same letter.

FINAL SELF-CHECK:

Before returning the JSON, solve all five questions again.

For every question check:

- Is it actually about {topic}?
- Is exactly one option correct?
- Does correct_answer point to that option?
- Does the selected option contain the complete correct answer?
- Is the explanation accurate?
- Does the explanation match the exact question?
- Are the other options clearly incorrect?
- Is the question unambiguous?

If any question fails the check, rewrite it.

Return ONLY valid JSON.

Required structure:

{{
    "topic": "{topic}",
    "questions": [
        {{
            "question": "Question text",
            "options": {{
                "A": "Option A",
                "B": "Option B",
                "C": "Option C",
                "D": "Option D"
            }},
            "correct_answer": "A",
            "explanation": "Explanation specifically for this question."
        }},
        {{
            "question": "Question text",
            "options": {{
                "A": "Option A",
                "B": "Option B",
                "C": "Option C",
                "D": "Option D"
            }},
            "correct_answer": "B",
            "explanation": "Explanation specifically for this question."
        }},
        {{
            "question": "Question text",
            "options": {{
                "A": "Option A",
                "B": "Option B",
                "C": "Option C",
                "D": "Option D"
            }},
            "correct_answer": "C",
            "explanation": "Explanation specifically for this question."
        }},
        {{
            "question": "Question text",
            "options": {{
                "A": "Option A",
                "B": "Option B",
                "C": "Option C",
                "D": "Option D"
            }},
            "correct_answer": "D",
            "explanation": "Explanation specifically for this question."
        }},
        {{
            "question": "Question text",
            "options": {{
                "A": "Option A",
                "B": "Option B",
                "C": "Option C",
                "D": "Option D"
            }},
            "correct_answer": "A",
            "explanation": "Explanation specifically for this question."
        }}
    ]
}}

STRICT REQUIREMENTS:

- Exactly 5 questions.
- Exactly 4 options per question.
- Options must be A, B, C and D.
- correct_answer must be exactly A, B, C or D.
- Every question must belong to {topic}.
- Exactly one correct answer per question.
- Every explanation must correspond to its own question.
- The correct answer must be factually correct.
- The correct answer must be present in its corresponding option.
- No contradictory explanations.
- No duplicate questions.
- No ambiguous questions.
- No subjective questions.
- Do not mix unrelated subjects.
- Do not include markdown.
- Do not include commentary.
- Do not include anything outside the JSON.
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",

        messages=[
            {
                "role": "system",
                "content": (
                    "You are an extremely accurate educational quiz "
                    "generator. Accuracy is more important than creativity. "
                    "Independently solve every question before assigning "
                    "correct_answer."
                )
            },
            {
                "role": "user",
                "content": prompt
            }
        ],

        temperature=0.0,
        max_tokens=2200,

        response_format={
            "type": "json_object"
        }
    )

    content = response.choices[0].message.content

    if not content:
        raise ValueError(
            "Empty quiz response received."
        )

    content = clean_json_response(content)

    return json.loads(content)


# =========================================
# VERIFY QUIZ
# =========================================

def verify_quiz(quiz, topic: str):

    quiz_json = json.dumps(
        quiz,
        ensure_ascii=False
    )

    prompt = f"""
You are the FINAL FACT-CHECKER for an educational quiz.

TOPIC:
{topic}

QUIZ:
{quiz_json}

Your job is to independently check EVERY question.

For EACH question, perform these steps in this exact order:

1. Read the question carefully.
2. Read options A, B, C and D.
3. Solve the question yourself.
4. Determine the ONE genuinely correct option.
5. Ignore the existing correct_answer field when solving.
6. Set correct_answer to the option that is actually correct.
7. Check that the selected option itself contains the correct answer.
8. Make sure no other option is also reasonably correct.
9. Write a NEW explanation specifically for THIS question.
10. The explanation MUST explain why the selected option is correct.
11. The explanation MUST NOT discuss another question.
12. The explanation MUST NOT discuss unrelated concepts.
13. The explanation MUST directly refer to the concept tested by the question.
14. Check that the question is actually about {topic}.
15. Remove or rewrite any ambiguous question.

CRITICAL EXPLANATION RULE:

Each explanation belongs ONLY to its own question.

For example:

Question:
"What type of wave requires a physical medium?"

Correct answer:
"Mechanical wave"

Correct explanation:
"Mechanical waves require a physical medium such as air, water, or a solid to transfer energy."

INCORRECT explanation:
"Mass is the amount of matter in an object."

Never mix explanations between questions.

FINAL REQUIREMENTS:

- Exactly 5 questions.
- Exactly 4 options per question.
- Options must be A, B, C and D.
- Exactly one correct answer per question.
- correct_answer must be correct.
- Every explanation must match its own question.
- Every explanation must explain its own correct answer.
- Questions must be specifically related to {topic}.
- No duplicate questions.
- No ambiguous questions.
- No contradictory information.

Return ONLY valid JSON.

Do not return markdown.
Do not return commentary.

Required structure:

{{
    "topic": "{topic}",
    "questions": [
        {{
            "question": "Question text",
            "options": {{
                "A": "Option A",
                "B": "Option B",
                "C": "Option C",
                "D": "Option D"
            }},
            "correct_answer": "A",
            "explanation": "Explanation specifically for this question and its correct answer."
        }}
    ]
}}
"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",

        messages=[
            {
                "role": "system",
                "content": (
                    "You are a strict educational fact checker. "
                    "Independently solve every question. "
                    "Never trust the supplied correct_answer. "
                    "Most importantly, ensure every explanation "
                    "matches the exact question it belongs to. "
                    "Return only valid JSON."
                )
            },
            {
                "role": "user",
                "content": prompt
            }
        ],

        temperature=0.0,
        max_tokens=2500,

        response_format={
            "type": "json_object"
        }
    )

    content = response.choices[0].message.content

    if not content:
        raise ValueError(
            "Empty verification response."
        )

    content = clean_json_response(content)

    verified_quiz = json.loads(content)

    # =========================================
    # FINAL VALIDATION
    # =========================================

    if not validate_quiz(verified_quiz):
        raise ValueError(
            "AI returned an invalid verified quiz."
        )

    verified_quiz["topic"] = topic

    return verified_quiz


# =========================================
# GENERATE VERIFIED QUIZ
# =========================================

def generate_quiz(topic: str):

    last_error = None

    for attempt in range(3):

        try:

            print(
                f"Generating quiz for '{topic}' "
                f"(attempt {attempt + 1}/3)"
            )

            # ---------------------------------
            # STEP 1: GENERATE
            # ---------------------------------

            quiz = generate_raw_quiz(topic)

            if not validate_quiz(quiz):

                raise ValueError(
                    "Generated quiz failed validation."
                )

            # ---------------------------------
            # STEP 2: VERIFY
            # ---------------------------------

            verified_quiz = verify_quiz(
                quiz,
                topic
            )

            if not validate_quiz(verified_quiz):

                raise ValueError(
                    "Verified quiz failed validation."
                )

            # Always preserve requested topic
            verified_quiz["topic"] = topic

            print(
                f"Quiz successfully generated and verified "
                f"for '{topic}'."
            )

            return verified_quiz

        except Exception as error:

            last_error = error

            print(
                f"Quiz generation attempt "
                f"{attempt + 1} failed:",
                error
            )

    print(
        "Quiz Generation Error:",
        last_error
    )

    raise HTTPException(
        status_code=500,
        detail=(
            "Could not generate a reliable quiz. "
            "Please try again."
        )
    )


# =========================================
# EXTRACT ANSWER
# =========================================

def extract_answer(user_message: str):

    answer = user_message.strip().upper()

    # Direct answer
    if answer in ["A", "B", "C", "D"]:
        return answer

    patterns = [
        r"\bOPTION\s*([ABCD])\b",
        r"\bANSWER\s*(?:IS|:)?\s*([ABCD])\b",
        r"\bI\s+(?:CHOOSE|SELECT)\s+([ABCD])\b",
        r"^\s*([ABCD])[\)\.\:\-]?"
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            answer,
            flags=re.IGNORECASE
        )

        if match:
            return match.group(1).upper()

    return None


# =========================================
# FIND QUIZ TOPIC
# =========================================

def extract_quiz_topic(message: str):

    text = message.strip()

    patterns = [
        r"quiz\s+(?:on|about)\s+(.+)",
        r"test\s+(?:me\s+)?(?:on|about)\s+(.+)",
        r"mcq\s+(?:on|about)\s+(.+)",
        r"multiple\s+choice\s+(?:quiz\s+)?(?:on|about)\s+(.+)"
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE
        )

        if match:

            topic = match.group(1).strip()

            if topic:
                return topic

    return None


# =========================================
# START QUIZ
# =========================================

def start_quiz(
    session_id: str,
    topic: str
):

    pending_quiz_topics.pop(
        session_id,
        None
    )

    quiz = generate_quiz(topic)

    questions = quiz["questions"]

    if len(questions) != 5:

        raise HTTPException(
            status_code=500,
            detail=(
                "Quiz generation did not return "
                "exactly 5 questions."
            )
        )

    quiz_sessions[session_id] = {

        "quiz_id": str(uuid4()),

        "topic": topic,

        "questions": questions,

        "current_question": 0,

        "score": 0,

        "answers": []
    }

    question = questions[0]

    return {

        "type": "quiz",

        "status": "active",

        "quiz_id": quiz_sessions[
            session_id
        ]["quiz_id"],

        "topic": topic,

        "question_number": 1,

        "total_questions": 5,

        "question": question["question"],

        "options": question["options"]
    }


# =========================================
# PROCESS QUIZ ANSWER
# =========================================

def process_quiz_answer(
    session_id: str,
    user_message: str
):

    if session_id not in quiz_sessions:

        raise HTTPException(
            status_code=404,
            detail=(
                "Quiz session not found. "
                "Please start a new quiz."
            )
        )

    quiz = quiz_sessions[session_id]

    answer = extract_answer(user_message)

    if not answer:

        return {
            "type": "quiz",
            "status": "waiting_for_answer",
            "message": (
                "Please answer with A, B, C, or D."
            )
        }

    current_index = quiz["current_question"]

    if current_index >= 5:

        del quiz_sessions[session_id]

        return {
            "type": "quiz",
            "status": "complete",
            "score": quiz["score"],
            "total": 5,
            "percentage": int(
                (quiz["score"] / 5) * 100
            ),
            "results": [],
            "incorrect_answers": []
        }

    current_question = quiz["questions"][current_index]

    correct_answer = (
        current_question["correct_answer"]
        .strip()
        .upper()
    )

    is_correct = answer == correct_answer

    if is_correct:
        quiz["score"] += 1

    quiz["answers"].append(
        {
            "question": current_index + 1,
            "selected": answer,
            "correct": correct_answer,
            "is_correct": is_correct
        }
    )

    # =========================================
    # QUESTION 5 COMPLETE
    # =========================================

    if current_index == 4:

        score = quiz["score"]

        percentage = int(
            (score / 5) * 100
        )

        results = []

        for item in quiz["answers"]:

            results.append(
                {
                    "question": item["question"],
                    "status": (
                        "Correct"
                        if item["is_correct"]
                        else "Incorrect"
                    )
                }
            )

        incorrect_answers = []

        for index, item in enumerate(
            quiz["answers"]
        ):

            if not item["is_correct"]:

                question = quiz["questions"][index]

                incorrect_answers.append(
                    {
                        "question": item["question"],
                        "selected": item["selected"],
                        "correct": item["correct"],
                        "explanation": question["explanation"]
                    }
                )

        del quiz_sessions[session_id]

        return {
            "type": "quiz",
            "status": "complete",
            "score": score,
            "total": 5,
            "percentage": percentage,
            "results": results,
            "incorrect_answers": incorrect_answers
        }

    # =========================================
    # NEXT QUESTION
    # =========================================

    quiz["current_question"] += 1

    next_index = quiz["current_question"]

    if next_index >= 5:

        del quiz_sessions[session_id]

        return {
            "type": "quiz",
            "status": "complete",
            "score": quiz["score"],
            "total": 5,
            "percentage": int(
                (quiz["score"] / 5) * 100
            ),
            "results": [],
            "incorrect_answers": []
        }

    next_question = quiz["questions"][next_index]

    return {
        "type": "quiz",
        "status": "answer_received",

        "correct": is_correct,

        "selected_answer": answer,

        "correct_answer": correct_answer,

        "explanation": current_question["explanation"],

        "score": quiz["score"],

        "question_number": next_index + 1,

        "total_questions": 5,

        "question": next_question["question"],

        "options": next_question["options"],

        "feedback_question_number": current_index + 1
    }


# =========================================
# STUDY AI
# =========================================

@app.post("/study-ai")
def study_ai(request: StudyRequest):

    message = request.message.strip()

    # =====================================
    # EXISTING QUIZ
    # =====================================

    if request.session_id in quiz_sessions:

        return process_quiz_answer(
            request.session_id,
            message
        )

    # =====================================
    # WAITING FOR QUIZ TOPIC
    # =====================================

    if request.session_id in pending_quiz_topics:

        topic = message.strip()

        if not topic:

            return {
                "type": "quiz_setup",
                "status": "waiting_for_topic",
                "message": (
                    "Please enter the subject or "
                    "topic you want to be tested on."
                )
            }

        return start_quiz(
            request.session_id,
            topic
        )

    # =====================================
    # NEW QUIZ DETECTION
    # =====================================

    quiz_keywords = [
        "quiz",
        "mcq",
        "multiple choice",
        "test me"
    ]

    is_quiz_request = any(
        keyword in message.lower()
        for keyword in quiz_keywords
    )

    if is_quiz_request:

        topic = extract_quiz_topic(message)

        if not topic:

            pending_quiz_topics[
                request.session_id
            ] = True

            return {
                "type": "quiz_setup",
                "status": "waiting_for_topic",
                "message": (
                    "Sure! What subject or topic "
                    "would you like to be tested on?"
                )
            }

        return start_quiz(
            request.session_id,
            topic
        )

    # =====================================
    # NORMAL STUDY AI
    # =====================================

    system_prompt = (
        "You are StudyAI, an AI study assistant for students.\n\n"

        "PRIMARY ROLE:\n"
        "Help students learn subjects, understand concepts, "
        "create study plans, practice questions, prepare for "
        "exams, and improve their learning.\n\n"

        "AREAS YOU CAN HELP WITH:\n"
        "- Study plans\n"
        "- Subject explanations\n"
        "- Practice questions\n"
        "- Exam preparation\n"
        "- Programming and technical subjects\n"
        "- Problem solving\n"
        "- Revision plans\n"
        "- Learning roadmaps\n"
        "- Beginner-friendly explanations\n\n"

        "RESPONSE STYLE:\n"
        "1. Explain concepts clearly and simply.\n"
        "2. Use headings, bullets, numbered steps, and examples.\n"
        "3. For study plans, organize by day or week.\n"
        "4. Be practical and focused.\n"
        "5. Keep simple answers concise.\n"
        "6. Explain step-by-step when requested.\n"
        "7. Use conversation history when useful.\n"
    )

    messages = [
        {
            "role": "system",
            "content": system_prompt
        }
    ]

    bounded_study_history = compact_tailor_history(
        [item.model_dump() for item in request.history]
    )

    for history_message in bounded_study_history:

        role = (
            "user"
            if history_message.get("sender") == "user"
            else "assistant"
        )

        text = str(history_message.get("text") or "")

        if text:
            messages.append(
                {
                    "role": role,
                    "content": text
                }
            )

    messages.append(
        {
            "role": "user",
            "content": message
        }
    )

    try:

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.5,
            max_tokens=STUDY_MAX_OUTPUT_TOKENS
        )

        choice = response.choices[0]
        reply = choice.message.content or ""

        return {
            "type": "normal",
            "reply": reply,
            "truncated": getattr(choice, "finish_reason", None) == "length"
        }

    except Exception as error:

        print(
            "StudyAI Error:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "StudyAI could not generate a response."
            )

        )
# =========================================
# LIFE AI
# =========================================

class LifeRequest(BaseModel):
    message: str
    history: list[Message] = Field(default_factory=list)


@app.post("/life-ai")
def life_ai(request: LifeRequest):

    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Please enter a message."
        )

    system_prompt = (
        "You are LifeAI, a practical and friendly personal "
        "productivity assistant.\n\n"

        "YOUR PURPOSE:\n"
        "Help users set meaningful goals, create routines, "
        "build habits, manage tasks, improve productivity, "
        "and organize their personal life.\n\n"

        "IMPORTANT CONVERSATION RULE:\n"
        "Talk to the user like a helpful personal assistant, "
        "not like a textbook or an article.\n"
        "Do NOT dump long frameworks, lectures, or generic "
        "goal-setting explanations unless the user specifically "
        "asks for them.\n\n"

        "GOAL SETTING:\n"
        "When a user wants help setting goals, have a short "
        "conversation first.\n"
        "If the user explicitly asks for a detailed plan, "
        "schedule, roadmap, or table and provides its scope, "
        "answer directly instead of asking follow-up questions.\n"
        "Ask only 1-3 useful questions at a time.\n"
        "Useful information may include:\n"
        "- What they want to achieve\n"
        "- Why it matters\n"
        "- Their desired timeline\n"
        "- Their available time\n"
        "- Their current situation\n\n"

        "Once you have enough information:\n"
        "1. Create a clear main goal.\n"
        "2. Make it specific and measurable.\n"
        "3. Break it into realistic milestones.\n"
        "4. Give practical next actions.\n"
        "5. Suggest a simple way to track progress.\n\n"

        "ROUTINES:\n"
        "When the user wants a routine, first understand "
        "their schedule and priorities when necessary.\n"
        "If they explicitly request a detailed routine or plan, "
        "provide a practical best-effort version immediately and "
        "state any assumptions briefly.\n"
        "Then create a realistic routine with priorities, "
        "time blocks, and reasonable breaks.\n"
        "Do not create an unrealistic schedule packed with tasks.\n\n"

        "HABITS:\n"
        "When the user wants to build or track habits, help "
        "them choose a small number of realistic habits.\n"
        "Suggest clear frequency and tracking methods.\n"
        "Focus on consistency rather than perfection.\n\n"

        "TASKS AND PRODUCTIVITY:\n"
        "Help users prioritize tasks based on importance, "
        "urgency, effort, and available time.\n"
        "Give clear next actions rather than vague advice.\n\n"

        "CONVERSATION MEMORY:\n"
        "Use the conversation history when relevant.\n"
        "Remember goals, timelines, routines, habits, tasks, "
        "and preferences mentioned earlier in the conversation.\n"
        "If the user refers to something previously discussed, "
        "use the available history instead of asking them "
        "to repeat it.\n\n"

        "RESPONSE STYLE:\n"
        "- Be friendly, practical, and encouraging.\n"
        "- Keep responses concise unless the user asks for detail.\n"
        "- Prefer short paragraphs and bullet points.\n"
        "- Use Markdown when it improves readability.\n"
        "- Avoid unnecessary repetition.\n"
        "- Do not ask many questions at once.\n"
        "- Ask a question only when the answer is useful for "
        "personalizing the next step.\n"
        "- Always move the conversation forward.\n"
        "- Do not pretend to know information the user has not provided.\n"
        "- Never promise guaranteed results.\n\n"

        "EXAMPLE BEHAVIOR:\n"
        "If the user says 'Help me set my goals', do NOT respond "
        "with a long explanation of goal-setting frameworks.\n"
        "Instead, respond naturally with something like:\n"
        "'Absolutely. Let's keep it simple. What's the main "
        "thing you'd like to achieve in the next 6-12 months?'\n"
        "Then continue the conversation based on their answer.\n\n"

        "FINAL PRINCIPLE:\n"
        "Your job is not just to give advice. Help the user turn "
        "their ideas into realistic actions and keep the conversation "
        "focused on progress."
    )

    messages = [
        {
            "role": "system",
            "content": system_prompt
        }
    ]

    # -----------------------------------------
    # ADD CONVERSATION HISTORY
    # -----------------------------------------

    bounded_life_history = compact_tailor_history(
        [item.model_dump() for item in request.history]
    )

    for history_message in bounded_life_history:

        role = (
            "user"
            if history_message.get("sender") == "user"
            else "assistant"
        )

        text = str(history_message.get("text") or "")

        if text:
            messages.append(
                {
                    "role": role,
                    "content": text
                }
            )

    # -----------------------------------------
    # CURRENT MESSAGE
    # -----------------------------------------

    messages.append(
        {
            "role": "user",
            "content": message
        }
    )

    # -----------------------------------------
    # GENERATE LIFEAI RESPONSE
    # -----------------------------------------

    try:

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            temperature=0.6,
            max_tokens=LIFE_MAX_OUTPUT_TOKENS
        )

        choice = response.choices[0]
        reply = choice.message.content or ""

        return {
            "type": "normal",
            "reply": reply,
            "truncated": getattr(choice, "finish_reason", None) == "length"
        }

    except Exception as error:

        print(
            "LifeAI Error:",
            error
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "LifeAI could not generate a response."
            )
        )


# =========================================
# CODE / FINANCE / HEALTH AI
# =========================================

class SpecializedAgentRequest(BaseModel):
    message: str
    history: list[Message] = Field(default_factory=list)


SPECIALIZED_MAX_OUTPUT_TOKENS = 5000


def generate_specialized_agent_response(
    request: SpecializedAgentRequest,
    system_prompt: str,
    temperature: float,
):
    message = request.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Please enter a message."
        )

    messages = [{
        "role": "system",
        "content": system_prompt
    }]

    bounded_history = compact_tailor_history(
        [item.model_dump() for item in request.history]
    )

    for history_message in bounded_history:
        text = str(history_message.get("text") or "")
        if text:
            messages.append({
                "role": (
                    "user"
                    if history_message.get("sender") == "user"
                    else "assistant"
                ),
                "content": text
            })

    messages.append({
        "role": "user",
        "content": message
    })

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=messages,
        temperature=temperature,
        max_tokens=SPECIALIZED_MAX_OUTPUT_TOKENS
    )

    choice = response.choices[0]
    return {
        "type": "normal",
        "reply": choice.message.content or "",
        "truncated": getattr(choice, "finish_reason", None) == "length"
    }


CODE_AI_PROMPT = (
    "You are CodeAI, a programming and software development assistant.\n\n"
    "Focus on programming, debugging, algorithms, software development, "
    "frameworks, databases, APIs, and technical learning. Give clear "
    "explanations and practical examples. Use properly formatted Markdown "
    "code blocks for code, and tables when comparisons or structured data "
    "benefit from them. Preserve complete code and explain errors safely. "
    "Do not discuss career advice unless the user asks."
)


FINANCE_AI_PROMPT = (
    "You are FinanceAI, a financial education and planning assistant.\n\n"
    "Focus on budgeting, saving, investing concepts, personal finance "
    "education, financial planning basics, and financial literacy. Explain "
    "clearly and structure plans with tables or lists when useful. Clearly "
    "distinguish general educational information from professional advice. "
    "Never promise returns or present financial outcomes as guaranteed."
)


HEALTH_AI_PROMPT = (
    "You are HealthAI, a general health, fitness, nutrition, and wellness "
    "information assistant.\n\n"
    "Give practical, safe, evidence-aware general information and use tables "
    "or lists when useful. Do not diagnose conditions or present uncertain "
    "medical information as certainty. For serious symptoms or emergencies, "
    "recommend appropriate professional medical care."
)


@app.post("/code-ai")
def code_ai(request: SpecializedAgentRequest):
    try:
        return generate_specialized_agent_response(
            request,
            CODE_AI_PROMPT,
            0.4
        )
    except HTTPException:
        raise
    except Exception as error:
        print("CodeAI Error:", error)
        raise HTTPException(
            status_code=500,
            detail="CodeAI could not generate a response."
        )


@app.post("/finance-ai")
def finance_ai(request: SpecializedAgentRequest):
    try:
        return generate_specialized_agent_response(
            request,
            FINANCE_AI_PROMPT,
            0.5
        )
    except HTTPException:
        raise
    except Exception as error:
        print("FinanceAI Error:", error)
        raise HTTPException(
            status_code=500,
            detail="FinanceAI could not generate a response."
        )


@app.post("/health-ai")
def health_ai(request: SpecializedAgentRequest):
    try:
        return generate_specialized_agent_response(
            request,
            HEALTH_AI_PROMPT,
            0.5
        )
    except HTTPException:
        raise
    except Exception as error:
        print("HealthAI Error:", error)
        raise HTTPException(
            status_code=500,
            detail="HealthAI could not generate a response."
        )