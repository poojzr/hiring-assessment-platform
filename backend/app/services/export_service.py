import csv
import io
import json
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from ..models.candidate import Candidate
from ..models.job_role import JobRoleThreshold
from ..models.assessment import AssessmentSession, Answer, AssessmentTemplate
from ..models.proctoring import ProctorEvent

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

def _get_violation_counts(violations: List) -> Dict[str, int]:
    counts = {
        "NO_FACE": 0,
        "MULTIPLE_FACE": 0,
        "MOBILE_DETECTED": 0,
        "LOUD_VOICE": 0,
        "MULTIPLE_VOICE": 0,
        "LIP_SYNC_MISMATCH": 0,
        "TAB_SWITCH": 0,
        "COPY_PASTE": 0,
        "SCREEN_SHARE": 0,
        "FULLSCREEN_EXIT": 0,
        "DARK_ENVIRONMENT": 0,
        "WARNING_SENT": 0,
        "SESSION_TERMINATED": 0
    }
    
    for v in violations:
        event_type = v.event_type.value if hasattr(v.event_type, 'value') else str(v.event_type)
        if event_type in counts:
            counts[event_type] += 1
    
    return counts

def _sanitize_csv_field(value: Any) -> str:
    if value is None:
        return ""
    str_value = str(value)
    if str_value and str_value[0] in "=+-@\t\r":
        return "'" + str_value
    return str_value

def export_candidate_data(db: Session, candidate_id: int, format: str = "json") -> Dict[str, Any]:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise ValueError(f"Candidate {candidate_id} not found")
    
    sessions = db.query(AssessmentSession).filter(
        AssessmentSession.candidate_id == candidate_id
    ).all()
    
    all_violations = []
    for session in sessions:
        violations = db.query(ProctorEvent).filter(
            ProctorEvent.session_id == session.id
        ).all()
        all_violations.extend(violations)
    
    violation_counts = _get_violation_counts(all_violations)
    
    data = {
        "candidate": {
            "id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "phone": candidate.phone,
            "ats_score": candidate.ats_score,
            "shortlisted": candidate.shortlisted,
            "job_role": candidate.job_role_threshold.job_role_name if candidate.job_role_threshold else None,
            "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
            "updated_at": candidate.updated_at.isoformat() if candidate.updated_at else None,
        },
        "sessions": []
    }
    
    total_score = 0
    total_integrity = 0
    session_count = len(sessions)
    
    for session in sessions:
        answers = db.query(Answer).filter(Answer.session_id == session.id).all()
        violations = db.query(ProctorEvent).filter(
            ProctorEvent.session_id == session.id
        ).all()
        
        template = db.query(AssessmentTemplate).filter(
            AssessmentTemplate.id == session.template_id
        ).first()
        
        if session.total_score:
            total_score += session.total_score
        if session.integrity_score:
            total_integrity += session.integrity_score
        
        session_violation_counts = _get_violation_counts(violations)
        
        session_data = {
            "id": session.id,
            "status": session.status,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "finished_at": session.finished_at.isoformat() if session.finished_at else None,
            "total_score": session.total_score,
            "integrity_score": session.integrity_score,
            "cheating_risk": session.cheating_risk,
            "eligibility": session.eligibility,
            "template_name": template.name if template else None,
            "violation_counts": session_violation_counts,
            "answers": [
                {
                    "question_id": a.question_id,
                    "answer_data": a.answer_data,
                    "is_correct": a.is_correct,
                    "auto_score": a.auto_score,
                    "manual_score": a.manual_score,
                }
                for a in answers
            ],
            "violations": [
                {
                    "type": v.event_type.value if hasattr(v.event_type, 'value') else str(v.event_type),
                    "severity": v.severity.value if hasattr(v.severity, 'value') else str(v.severity),
                    "timestamp": v.timestamp.isoformat() if v.timestamp else None,
                    "snapshot_url": v.snapshot_url,
                    "clip_url": v.clip_url,
                }
                for v in violations
            ]
        }
        data["sessions"].append(session_data)
    
    data["summary"] = {
        "total_sessions": session_count,
        "average_score": round(total_score / session_count, 2) if session_count > 0 else 0,
        "average_integrity": round(total_integrity / session_count, 2) if session_count > 0 else 0,
        "total_violations": len(all_violations),
        "violation_counts": violation_counts
    }
    
    if format == "json":
        return {
            "data": json.dumps(data, default=str, indent=2).encode('utf-8'),
            "filename": f"candidate_{candidate_id}_{now().strftime('%Y%m%d_%H%M%S')}.json",
            "content_type": "application/json"
        }
    elif format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        
        headers = [
            "Candidate Name", "Email", "Job Role", "ATS Score", "Shortlisted",
            "Session ID", "Status", "Score", "Integrity", "Eligibility",
            "NO_FACE", "MULTIPLE_FACE", "MOBILE_DETECTED", "LOUD_VOICE",
            "MULTIPLE_VOICE", "LIP_SYNC_MISMATCH", "TAB_SWITCH", "COPY_PASTE",
            "SCREEN_SHARE", "FULLSCREEN_EXIT", "DARK_ENVIRONMENT", "WARNING_SENT", "SESSION_TERMINATED"
        ]
        writer.writerow([_sanitize_csv_field(h) for h in headers])
        
        for session in data["sessions"]:
            vc = session.get("violation_counts", {})
            row = [
                candidate.name,
                candidate.email,
                candidate.job_role_threshold.job_role_name if candidate.job_role_threshold else "",
                candidate.ats_score or "",
                "Yes" if candidate.shortlisted else "No",
                session["id"],
                session["status"],
                session["total_score"] or "",
                session["integrity_score"] or "",
                session["eligibility"],
                vc.get("NO_FACE", 0),
                vc.get("MULTIPLE_FACE", 0),
                vc.get("MOBILE_DETECTED", 0),
                vc.get("LOUD_VOICE", 0),
                vc.get("MULTIPLE_VOICE", 0),
                vc.get("LIP_SYNC_MISMATCH", 0),
                vc.get("TAB_SWITCH", 0),
                vc.get("COPY_PASTE", 0),
                vc.get("SCREEN_SHARE", 0),
                vc.get("FULLSCREEN_EXIT", 0),
                vc.get("DARK_ENVIRONMENT", 0),
                vc.get("WARNING_SENT", 0),
                vc.get("SESSION_TERMINATED", 0),
            ]
            writer.writerow([_sanitize_csv_field(field) for field in row])
        
        return {
            "data": output.getvalue().encode('utf-8'),
            "filename": f"candidate_{candidate_id}_{now().strftime('%Y%m%d_%H%M%S')}.csv",
            "content_type": "text/csv"
        }
    elif format == "pdf":
        try:
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.colors import black, grey, beige, blue
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.enums import TA_CENTER
            
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4)
            styles = getSampleStyleSheet()
            story = []
            
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                textColor=blue,
                alignment=TA_CENTER,
                spaceAfter=30
            )
            story.append(Paragraph("Candidate Assessment Report", title_style))
            
            story.append(Paragraph(f"Candidate: {candidate.name}", styles['Normal']))
            story.append(Paragraph(f"Email: {candidate.email}", styles['Normal']))
            story.append(Paragraph(f"Job Role: {candidate.job_role_threshold.job_role_name if candidate.job_role_threshold else 'N/A'}", styles['Normal']))
            story.append(Paragraph(f"ATS Score: {candidate.ats_score or 'N/A'}%", styles['Normal']))
            story.append(Paragraph(f"Shortlisted: {'Yes' if candidate.shortlisted else 'No'}", styles['Normal']))
            story.append(Spacer(1, 20))
            
            story.append(Paragraph("Violation Summary", styles['Heading2']))
            vc = data["summary"]["violation_counts"]
            violation_table_data = [["Violation Type", "Count"]]
            for key, value in vc.items():
                if value > 0:
                    violation_table_data.append([key.replace("_", " ").title(), str(value)])
            
            if len(violation_table_data) > 1:
                t = Table(violation_table_data)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), black),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), beige),
                    ('GRID', (0, 0), (-1, -1), 1, black),
                ]))
                story.append(t)
            else:
                story.append(Paragraph("No violations recorded", styles['Normal']))
            
            story.append(Spacer(1, 20))
            
            story.append(Paragraph("Sessions Summary", styles['Heading2']))
            session_table_data = [["Session ID", "Status", "Score", "Integrity", "Eligibility"]]
            for session in data["sessions"]:
                session_table_data.append([
                    str(session["id"]),
                    session["status"],
                    f"{session['total_score']}%" if session['total_score'] else "N/A",
                    f"{session['integrity_score']}%" if session['integrity_score'] else "N/A",
                    session["eligibility"]
                ])
            
            t = Table(session_table_data)
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), black),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), beige),
                ('GRID', (0, 0), (-1, -1), 1, black),
            ]))
            story.append(t)
            
            doc.build(story)
            buffer.seek(0)
            
            return {
                "data": buffer.getvalue(),
                "filename": f"candidate_{candidate_id}_{now().strftime('%Y%m%d_%H%M%S')}.pdf",
                "content_type": "application/pdf"
            }
        except ImportError:
            return {
                "data": json.dumps(data, default=str, indent=2).encode('utf-8'),
                "filename": f"candidate_{candidate_id}_{now().strftime('%Y%m%d_%H%M%S')}.json",
                "content_type": "application/json"
            }
        except Exception as e:
            print(f"PDF generation failed: {e}")
            return {
                "data": json.dumps(data, default=str, indent=2).encode('utf-8'),
                "filename": f"candidate_{candidate_id}_{now().strftime('%Y%m%d_%H%M%S')}.json",
                "content_type": "application/json"
            }
    else:
        raise ValueError(f"Unsupported format: {format}")

def export_bulk_candidates(db: Session, filters: Optional[Dict] = None, format: str = "csv") -> Dict[str, Any]:
    query = db.query(Candidate)
    
    if filters:
        if filters.get("job_role"):
            job_role_name = filters["job_role"]
            query = query.join(Candidate.job_role_threshold).filter(
                JobRoleThreshold.job_role_name == job_role_name
            )
        if filters.get("shortlisted") is not None:
            query = query.filter(Candidate.shortlisted == filters["shortlisted"])
        if filters.get("date_from"):
            query = query.filter(Candidate.created_at >= filters["date_from"])
        if filters.get("date_to"):
            query = query.filter(Candidate.created_at <= filters["date_to"])
        if filters.get("search"):
            search = filters["search"]
            query = query.filter(
                Candidate.name.ilike(f"%{search}%") | 
                Candidate.email.ilike(f"%{search}%")
            )
    
    candidates = query.all()
    
    if format == "json":
        data = []
        for c in candidates:
            sessions = db.query(AssessmentSession).filter(
                AssessmentSession.candidate_id == c.id
            ).all()
            
            all_violations = []
            for session in sessions:
                violations = db.query(ProctorEvent).filter(
                    ProctorEvent.session_id == session.id
                ).all()
                all_violations.extend(violations)
            
            violation_counts = _get_violation_counts(all_violations)
            
            data.append({
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "phone": c.phone,
                "ats_score": c.ats_score,
                "shortlisted": c.shortlisted,
                "job_role": c.job_role_threshold.job_role_name if c.job_role_threshold else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
                "total_sessions": len(sessions),
                "violation_counts": violation_counts
            })
        
        return {
            "data": json.dumps(data, default=str, indent=2).encode('utf-8'),
            "filename": f"candidates_export_{now().strftime('%Y%m%d_%H%M%S')}.json",
            "content_type": "application/json"
        }
    else:
        output = io.StringIO()
        writer = csv.writer(output)
        
        headers = [
            "ID", "Name", "Email", "Phone", "ATS Score", "Shortlisted", "Job Role", "Created At",
            "Total Sessions", "NO_FACE", "MULTIPLE_FACE", "MOBILE_DETECTED", "LOUD_VOICE",
            "MULTIPLE_VOICE", "LIP_SYNC_MISMATCH", "TAB_SWITCH", "COPY_PASTE",
            "SCREEN_SHARE", "FULLSCREEN_EXIT", "DARK_ENVIRONMENT", "WARNING_SENT", "SESSION_TERMINATED"
        ]
        writer.writerow([_sanitize_csv_field(h) for h in headers])
        
        for c in candidates:
            sessions = db.query(AssessmentSession).filter(
                AssessmentSession.candidate_id == c.id
            ).all()
            
            all_violations = []
            for session in sessions:
                violations = db.query(ProctorEvent).filter(
                    ProctorEvent.session_id == session.id
                ).all()
                all_violations.extend(violations)
            
            violation_counts = _get_violation_counts(all_violations)
            
            row = [
                c.id,
                c.name,
                c.email,
                c.phone or "",
                c.ats_score or "",
                "Yes" if c.shortlisted else "No",
                c.job_role_threshold.job_role_name if c.job_role_threshold else "",
                c.created_at.isoformat() if c.created_at else "",
                len(sessions),
                violation_counts.get("NO_FACE", 0),
                violation_counts.get("MULTIPLE_FACE", 0),
                violation_counts.get("MOBILE_DETECTED", 0),
                violation_counts.get("LOUD_VOICE", 0),
                violation_counts.get("MULTIPLE_VOICE", 0),
                violation_counts.get("LIP_SYNC_MISMATCH", 0),
                violation_counts.get("TAB_SWITCH", 0),
                violation_counts.get("COPY_PASTE", 0),
                violation_counts.get("SCREEN_SHARE", 0),
                violation_counts.get("FULLSCREEN_EXIT", 0),
                violation_counts.get("DARK_ENVIRONMENT", 0),
                violation_counts.get("WARNING_SENT", 0),
                violation_counts.get("SESSION_TERMINATED", 0),
            ]
            writer.writerow([_sanitize_csv_field(field) for field in row])
        
        return {
            "data": output.getvalue().encode('utf-8'),
            "filename": f"candidates_export_{now().strftime('%Y%m%d_%H%M%S')}.csv",
            "content_type": "text/csv"
        }

def _compute_session_reason(session) -> Optional[str]:
    if session.status == "completed":
        return None
    if session.status == "in_progress":
        return "Assessment in progress"
    if session.status == "expired":
        if not session.started_at:
            return "Link expired - assessment not attempted"
        return "Session expired while in progress"
    if session.status == "scheduled":
        if session.allowed_until and now() > session.allowed_until:
            return "Link expired - assessment not attempted"
        return "Not yet started"
    return None

def export_sessions_data(db: Session, filters: Optional[Dict] = None, format: str = "csv") -> Dict[str, Any]:
    query = db.query(AssessmentSession)

    if filters:
        if filters.get("status"):
            query = query.filter(AssessmentSession.status == filters["status"])
        if filters.get("eligibility"):
            query = query.filter(AssessmentSession.eligibility == filters["eligibility"])
        if filters.get("search"):
            search = filters["search"]
            query = query.join(AssessmentSession.candidate).filter(
                Candidate.name.ilike(f"%{search}%") | Candidate.email.ilike(f"%{search}%")
            )
        if filters.get("job_role"):
            query = query.join(AssessmentSession.template).filter(AssessmentTemplate.role == filters["job_role"])

    sessions = query.all()

    rows = []
    for session in sessions:
        candidate = session.candidate
        template = session.template
        violations = db.query(ProctorEvent).filter(ProctorEvent.session_id == session.id).all()
        violation_counts = _get_violation_counts(violations)
        rows.append({
            "candidate_id": candidate.id if candidate else None,
            "candidate_name": candidate.name if candidate else "Unknown",
            "candidate_email": candidate.email if candidate else "Unknown",
            "job_role": template.role if template else "Unknown",
            "status": session.status,
            "eligibility": session.eligibility,
            "reason": _compute_session_reason(session),
            "total_score": session.total_score,
            "integrity_score": session.integrity_score,
            "cheating_risk": session.cheating_risk,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "finished_at": session.finished_at.isoformat() if session.finished_at else None,
            "violation_counts": violation_counts,
            "total_violations": len(violations)
        })

    if format == "json":
        return {
            "data": json.dumps(rows, default=str, indent=2).encode('utf-8'),
            "filename": f"sessions_export_{now().strftime('%Y%m%d_%H%M%S')}.json",
            "content_type": "application/json"
        }
    else:
        output = io.StringIO()
        writer = csv.writer(output)

        headers = [
            "Candidate Name", "Email", "Job Role", "Status", "Eligibility", "Reason",
            "Score", "Integrity", "Cheating Risk", "Started At", "Finished At", "Total Violations",
            "NO_FACE", "MULTIPLE_FACE", "MOBILE_DETECTED", "LOUD_VOICE",
            "MULTIPLE_VOICE", "LIP_SYNC_MISMATCH", "TAB_SWITCH", "COPY_PASTE",
            "SCREEN_SHARE", "FULLSCREEN_EXIT", "DARK_ENVIRONMENT", "WARNING_SENT", "SESSION_TERMINATED"
        ]
        writer.writerow([_sanitize_csv_field(h) for h in headers])

        for row in rows:
            vc = row["violation_counts"]
            csv_row = [
                row["candidate_name"],
                row["candidate_email"],
                row["job_role"],
                row["status"],
                row["eligibility"],
                row["reason"] or "",
                row["total_score"] or "",
                row["integrity_score"] or "",
                row["cheating_risk"] or "",
                row["started_at"] or "",
                row["finished_at"] or "",
                row["total_violations"],
                vc.get("NO_FACE", 0),
                vc.get("MULTIPLE_FACE", 0),
                vc.get("MOBILE_DETECTED", 0),
                vc.get("LOUD_VOICE", 0),
                vc.get("MULTIPLE_VOICE", 0),
                vc.get("LIP_SYNC_MISMATCH", 0),
                vc.get("TAB_SWITCH", 0),
                vc.get("COPY_PASTE", 0),
                vc.get("SCREEN_SHARE", 0),
                vc.get("FULLSCREEN_EXIT", 0),
                vc.get("DARK_ENVIRONMENT", 0),
                vc.get("WARNING_SENT", 0),
                vc.get("SESSION_TERMINATED", 0),
            ]
            writer.writerow([_sanitize_csv_field(field) for field in csv_row])

        return {
            "data": output.getvalue().encode('utf-8'),
            "filename": f"sessions_export_{now().strftime('%Y%m%d_%H%M%S')}.csv",
            "content_type": "text/csv"
        }