import csv
import io
import json
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.assessment import QuestionBank
from ..schemas.assessment import QuestionCreate
from typing import Optional

def import_questions_from_file(
    db: Session,
    file_content: bytes,
    filename: str,
    created_by_id: Optional[int] = None
) -> dict:
    if filename.endswith(".json"):
        return _import_from_json(db, file_content, created_by_id)
    elif filename.endswith(".csv"):
        return _import_from_csv(db, file_content, created_by_id)
    else:
        return {"total": 0, "inserted": 0, "skipped": 0, "errors": ["Unsupported file format. Use CSV or JSON."]}

def _import_from_json(db: Session, file_content: bytes, created_by_id: Optional[int] = None) -> dict:
    try:
        data = json.loads(file_content.decode("utf-8"))
    except json.JSONDecodeError as e:
        return {"total": 0, "inserted": 0, "skipped": 0, "errors": [f"Invalid JSON: {str(e)}"]}

    if not isinstance(data, list):
        return {"total": 0, "inserted": 0, "skipped": 0, "errors": ["JSON must be an array of question objects."]}

    return _process_rows(db, data, created_by_id)

def _import_from_csv(db: Session, file_content: bytes, created_by_id: Optional[int] = None) -> dict:
    try:
        text = file_content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
    except Exception as e:
        return {"total": 0, "inserted": 0, "skipped": 0, "errors": [f"CSV parse error: {str(e)}"]}

    parsed_rows = []
    for row in rows:
        parsed = dict(row)
        for field in ("options", "public_test_cases", "hidden_test_cases"):
            if parsed.get(field):
                try:
                    parsed[field] = json.loads(parsed[field])
                except json.JSONDecodeError:
                    parsed[field] = None
        parsed_rows.append(parsed)

    return _process_rows(db, parsed_rows, created_by_id)

def _process_rows(db: Session, rows: list, created_by_id: Optional[int] = None) -> dict:
    total = len(rows)
    inserted = 0
    skipped = 0
    errors = []

    for i, row in enumerate(rows, 1):
        try:
            question_data = {
                "type": (row.get("type") or "").strip().upper(),
                "text": (row.get("text") or "").strip(),
                "description": (row.get("description") or "").strip() or None,
                "options": row.get("options"),
                "correct_answer": row.get("correct_answer"),
                "topic": (row.get("topic") or "").strip() or None,
                "difficulty": (row.get("difficulty") or "medium").strip(),
                "role": (row.get("role") or "").strip() or None,
                "language": (row.get("language") or "python").strip(),
                "public_test_cases": row.get("public_test_cases"),
                "hidden_test_cases": row.get("hidden_test_cases"),
                "coding_reference": row.get("coding_reference"),
            }
            
            validated = QuestionCreate(**question_data)

            existing = db.query(QuestionBank).filter(
                func.lower(QuestionBank.text) == func.lower(validated.text),
                QuestionBank.type == validated.type,
            ).first()
            
            if existing:
                skipped += 1
                continue

            question = QuestionBank(
                **validated.model_dump(),
                created_by=created_by_id
            )
            db.add(question)
            db.commit()
            inserted += 1
            
        except Exception as e:
            db.rollback()
            errors.append(f"Row {i}: {str(e)}")
            skipped += 1

    return {"total": total, "inserted": inserted, "skipped": skipped, "errors": errors}