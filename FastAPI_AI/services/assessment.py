import google.generativeai as genai
from config import Config
from validator import validator
from document_analyser import parse_gemini_response

genai.configure(api_key=Config.GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

def get_assessment(file_bytes: bytes, filename: str, selected_cert_type: str):
    response = validator(file_bytes, filename, selected_cert_type)
    extracted = response.get("extracted_info", {})
    candidate_name = extracted.get("candidate_name")
    exam_year = extracted.get("exam_year")
    subject_list = extracted.get("subjects", [])
    
    prompt = f"""
Task: You are an academic assessment engine evaluating whether a candidate genuinely understands the subjects listed on their academic certificate.

Please follow the instructions exactly.

Specifics:
1. Generate exactly 5 assessment questions.
2. Each question must come from a different subject in the candidate's subject list.
3. Questions must test practical understanding, reasoning, or application of knowledge.
4. Questions must be answerable within 30 seconds.
5. Difficulty must remain basic to intermediate.
6. Avoid simple memorization or definitions.
7. Avoid yes/no questions.
8. Return ONLY valid JSON with no markdown or additional text.

Candidate Information:
- Candidate Name: {candidate_name}
- Exam Year: {exam_year}
- Subjects Studied: {subject_list}

Question Guidelines:
- Prefer real-world or applied scenarios
- Keep wording short and clear
- Ensure each question matches its subject accurately
- Do not repeat subjects
- Do not generate trick questions
- Do not ask multiple questions in one item

JSON RESPONSE FORMAT:
{{
    "questions": [
        {{
            "id": 1,
            "subject": "",
            "question": "",
            "difficulty": "basic"
        }},
        {{
            "id": 2,
            "subject": "",
            "question": "",
            "difficulty": "basic"
        }},
        {{
            "id": 3,
            "subject": "",
            "question": "",
            "difficulty": "intermediate"
        }},
        {{
            "id": 4,
            "subject": "",
            "question": "",
            "difficulty": "basic"
        }},
        {{
            "id": 5,
            "subject": "",
            "question": "",
            "difficulty": "intermediate"
        }}
    ]
    }}
    """
    # After the prompt — call Gemini and parse
    try:
        gemini_response = model.generate_content(prompt)
        result = parse_gemini_response(gemini_response.text)
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}
    
def score_answer(questions: list, answers: list, extracted_info: dict):
    qa_pairs = []
    for i, question in enumerate(questions):
        answer = answers[i] if i < len(answers) else "No answer provided"
        qa_pairs.append({
            "subject": question.get("subject", ""),
            "question": question.get("question", ""),
            "answer": answer
        })

    prompt = f"""
Task: You are a strict academic examiner evaluating whether a candidate genuinely understands the subjects listed on their academic certificate.

Please follow the instructions exactly.

Specifics:
1. Evaluate each candidate answer independently.
2. Score every answer from 0 to 10.
3. Be strict and evidence-based.
4. Vague, generic, copied, contradictory, or irrelevant answers must score low.
5. Blank or missing answers must score 0.
6. Short answers may still score highly if accurate and specific.
7. Return ONLY valid JSON with no markdown or extra text.

Subject Areas:
{extracted_info.get('subjects', [])}

Question and Answer Pairs:
{qa_pairs}

SCORING GUIDE:
- 9-10 = Excellent understanding with accurate reasoning or application
- 7-8 = Good understanding with minor mistakes or omissions
- 5-6 = Partial understanding with noticeable gaps
- 3-4 = Weak understanding, vague or mostly incorrect
- 0-2 = No understanding, irrelevant answer, or no answer

SCORING RULES:
- Penalize memorized or generic responses
- Penalize answers that avoid the actual question
- Reward clarity, correctness, and subject understanding
- Do not inflate scores
- Use the full scoring range when appropriate

KNOWLEDGE SCORE:
Calculate:
(sum of all individual scores / maximum possible score) x 100

ASSESSMENT RULES:
- 75-100 = STRONG
- 50-74 = MODERATE
- 0-49 = WEAK

JSON RESPONSE FORMAT:
{{
    "individual_scores": [0, 0, 0, 0, 0],
    "knowledge_score": 0,
    "assessment": "",
    "feedback": [
        "",
        "",
        "",
        "",
        ""
    ]
}}
"""
    try:
        response = model.generate_content(prompt)
        result = parse_gemini_response(response.text)
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}
