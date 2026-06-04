import json
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Depends
from sqlmodel import Session, select
from validator import validator
from assessment import get_assessment, score_answer
# from auth_dependencies import verify_token

pipeline_router = APIRouter()

ALLOWED_EXTENSIONS = {"image/jpeg", "image/png", "application/pdf"}

@pipeline_router.post("/verify/analyse")
async def run_pipeline(
    file: UploadFile = File(...),
    cert_type: str = Form(...),
    # token_data: dict = Depends(verify_token)  # ← JWT verification
):

    # Step 3 — Read file into memory
    file_bytes = await file.read()
    filename = file.filename

    # Step 4 — Run document analysis + independent validation
    validation_result = validator(file_bytes, filename, cert_type)

    if not validation_result.get("success"):
        return {
            "success": False,
            "error": validation_result.get("error", "Analysis failed")
        }

    if validation_result.get("type_mismatch"):
        return {
            "success": False,
            "type_mismatch": True,
            "message": validation_result.get("message"),
            "detected_type": validation_result.get("detected_type")
        }

    # Step 5 — Generate knowledge assessment questions
    # assessment_result = get_assessment(file_bytes, filename, cert_type)

    # if not assessment_result.get("questions"):
    #     return {
    #         "success": False,
    #         "error": "Could not generate assessment questions"
    #     }

    # Step 6 — Save everything to DB
    # with Session(engine) as session:
    #     statement = select(Transaction).where(
    #         Transaction.transaction_ref == transaction_ref
    #     )
    #     transaction = session.exec(statement).first()
    #     if transaction:
    #         transaction.cert_type = cert_type
    #         transaction.verification_result = json.dumps(validation_result)
    #         transaction.questions = json.dumps(
    #             assessment_result.get("questions", [])
    #         )
    #         transaction.document_score = validation_result.get("final_score", 0)
    #         session.add(transaction)
    #         session.commit()

        print(validation_result)

    # Step 7 — Return questions to frontend
    return {
        "success": True,
        "stage": "assessment_pending",
        "transaction_ref": " test transaction_ref",
        "document_score": validation_result.get("final_score", 0),
        "document_verdict": validation_result.get("verdict", ""),
        "flagged_issues": validation_result.get("flagged_issues", []),
        "triggered_flags": validation_result.get("triggered_flags", []),
        # "questions": assessment_result.get("questions", []),
        "message": "Document analysed. Please answer the questions below."
    }


@pipeline_router.post("/verify/score")
async def score_assessment(
    answers: str = Form(...),
    token_data: dict = Depends(verify_token)  # ← add JWT
):
    email = token_data.get("email")
    answers_list = json.load(answers)

    # Get transaction from DB using email
    with Session(engine) as session:
        statement = select(Transaction).where(
            Transaction.email == email,
            Transaction.status == "success"
        ).order_by(Transaction.created_at.desc())
        transaction = session.exec(statement).first()

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if not transaction.verification_result or not transaction.questions:
        raise HTTPException(
            status_code=400,
            detail="No verification result found. Run analyse first."
        )

    transaction_ref = transaction.transaction_ref
    # rest stays the same

    # Step 3 — Retrieve stored data
    validation_result = json.loads(transaction.verification_result)
    questions = json.loads(transaction.questions)
    extracted_info = validation_result.get("extracted_info", {})
    document_score = transaction.document_score or 0

    # Step 4 — Score the answers
    score_result = score_answer(questions, answers_list, extracted_info)

    if not score_result.get("success", True):
        return {
            "success": False,
            "error": score_result.get("error", "Scoring failed")
        }

    knowledge_score = score_result.get("knowledge_score", 0)

    # Step 5 — Calculate final trust score
    final_trust_score = (document_score * 0.6) + (knowledge_score * 0.4)

    if final_trust_score >= 75:
        final_verdict = "AUTHENTIC"
    elif final_trust_score >= 40:
        final_verdict = "SUSPICIOUS"
    else:
        final_verdict = "HIGH_RISK"

    # Step 6 — Save final results to DB
    with Session(engine) as session:
        statement = select(Transaction).where(
            Transaction.transaction_ref == transaction_ref
        )
        transaction = session.exec(statement).first()
        if transaction:
            transaction.final_trust_score = round(final_trust_score)
            transaction.final_verdict = final_verdict
            session.add(transaction)
            session.commit()

    # Step 7 — Return final report
    return {
        "success": True,
        "transaction_ref": transaction_ref,
        "final_trust_score": round(final_trust_score),
        "final_verdict": final_verdict,
        "document_score": round(document_score),
        "knowledge_score": round(knowledge_score),
        "assessment": score_result.get("assessment", ""),
        "feedback": score_result.get("feedback", []),
        "individual_scores": score_result.get("individual_scores", []),
        "flagged_issues": validation_result.get("flagged_issues", []),
        "triggered_flags": validation_result.get("triggered_flags", []),
        "tampering_signs": validation_result.get("tampering_signs", []),
        "extracted_info": extracted_info
    }