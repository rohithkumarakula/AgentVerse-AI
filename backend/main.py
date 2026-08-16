from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from groq import Groq
from uuid import uuid4

import json
import re
import os


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
# TAILOR AI
# =========================================

@app.post("/tailor-ai")
def tailor_ai(request: TailorRequest):

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
    # ADD HISTORY
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
    # CURRENT MESSAGE
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
        model="llama-3.3-70b-versatile",

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
        model="llama-3.3-70b-versatile",

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

    for history_message in request.history:

        role = (
            "user"
            if history_message.sender == "user"
            else "assistant"
        )

        messages.append(
            {
                "role": role,
                "content": history_message.text
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
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.5,
            max_tokens=1000
        )

        reply = response.choices[0].message.content

        return {
            "type": "normal",
            "reply": reply
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