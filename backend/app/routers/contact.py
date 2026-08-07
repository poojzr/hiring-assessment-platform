from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import os
import requests
from ..config import settings

router = APIRouter(prefix="/contact", tags=["contact"])

class ContactMessage(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str

@router.post("")
async def send_contact_message(data: ContactMessage):
    api_key = os.environ.get("BREVO_API_KEY", getattr(settings, 'BREVO_API_KEY', ''))
    from_email = os.environ.get("FROM_EMAIL", getattr(settings, 'FROM_EMAIL', 'poojithayekula44@gmail.com'))

    if not api_key:
        raise HTTPException(status_code=500, detail="Email configuration missing")

    subject = f"Contact Form: {data.subject}"
    body = f"""
New Contact Form Submission

Name: {data.name}
Email: {data.email}
Subject: {data.subject}
Message: {data.message}


Reply to: {data.email}
"""

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json",
    }
    payload = {
        "sender": {"email": from_email, "name": "Hiring Team"},
        "to": [{"email": from_email}],
        "replyTo": {"email": data.email, "name": data.name},
        "subject": subject,
        "textContent": body,
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        if response.status_code in (200, 201):
            return {"success": True, "message": "Email sent successfully"}
        else:
            print(f"[CONTACT EMAIL ERROR] {response.status_code} {response.text}")
            raise HTTPException(status_code=500, detail="Failed to send email")
    except requests.RequestException as e:
        print(f"[CONTACT EMAIL ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))