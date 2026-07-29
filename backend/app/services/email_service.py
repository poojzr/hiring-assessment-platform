import os
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from ..config import settings

def now():
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

def _send_email_with_retry(to_email: str, subject: str, body: str, max_retries: int = 3) -> bool:
    smtp_host = os.environ.get("SMTP_HOST", getattr(settings, 'SMTP_HOST', ''))
    smtp_user = os.environ.get("SMTP_USER", getattr(settings, 'SMTP_USER', ''))
    smtp_pass = os.environ.get("SMTP_PASS", getattr(settings, 'SMTP_PASS', ''))
    smtp_port = int(os.environ.get("SMTP_PORT", getattr(settings, 'SMTP_PORT', '587')))
    
    if not (smtp_host and smtp_user and smtp_pass):
        print("=" * 60)
        print("[EMAIL CONSOLE FALLBACK]")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print(body)
        print("=" * 60)
        return True
    
    for attempt in range(max_retries):
        try:
            msg = MIMEMultipart()
            msg["From"] = smtp_user
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))
            
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, to_email, msg.as_string())
            
            print(f"[EMAIL] Sent to {to_email}")
            return True
            
        except Exception as e:
            print(f"[EMAIL ERROR] Attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
    
    print("=" * 60)
    print("[EMAIL CONSOLE FALLBACK] (All retries failed)")
    print(f"To: {to_email}")
    print(f"Subject: {subject}")
    print(body)
    print("=" * 60)
    return False

def send_assessment_email(to_email: str, candidate_name: str, access_token: str, deadline_str: str, job_role: str) -> bool:
    frontend_url = os.environ.get("FRONTEND_URL", getattr(settings, 'FRONTEND_URL', 'http://localhost:5173'))
    link = f"{frontend_url}/assessment/{access_token}"
    
    if not deadline_str:
        deadline_dt = now() + timedelta(days=3)
        deadline_str = deadline_dt.strftime("%Y-%m-%d %H:%M IST")
    
    subject = f"Assessment Invitation - {job_role}"
    body = f"""
Dear {candidate_name},

You have been shortlisted for the {job_role} position based on your application.

Please complete your assessment by clicking the link below:
{link}

Valid Until: {deadline_str}
Duration: As specified in the assessment

Important Instructions:
Ensure a stable internet connection
Webcam and microphone are required for proctoring
Find a quiet environment without interruptions
Do not switch tabs or leave the assessment window
You cannot pause the assessment once started

Good luck with your assessment!

Best regards,
Hiring Team
"""
    return _send_email_with_retry(to_email, subject, body)

def send_rejection_email(
    to_email: str,
    candidate_name: str,
    job_role: str,
    score: float = None,
    integrity: float = None
) -> bool:
    subject = f"Update on Your Application for {job_role}"
    
    score_line = f"\nYour assessment score: {score}%" if score is not None else ""
    integrity_line = f"\nIntegrity score: {integrity}%" if integrity is not None else ""
    
    body = f"""
Dear {candidate_name},

Thank you for taking the time to complete the assessment for the {job_role} position.
{score_line}{integrity_line}

After careful review, we regret to inform you that we will not be moving forward with your application at this time.

We appreciate your interest and wish you the best in your future endeavors.

Best regards,
Hiring Team
"""
    return _send_email_with_retry(to_email, subject, body)

def send_shortlist_email(
    to_email: str,
    candidate_name: str,
    job_role: str,
    score: float,
    integrity: float = None
) -> bool:
    subject = f"Congratulations! You've Been Shortlisted for {job_role}"
    
    score_line = f"Assessment score: {score}%"
    integrity_line = f"\nIntegrity score: {integrity}%" if integrity is not None else ""
    
    body = f"""
Dear {candidate_name},

Congratulations! 

We are pleased to inform you that you have been shortlisted for the next stage of the selection process for the {job_role} position.

Your assessment performance:
- {score_line}{integrity_line}

Your results stood out among our candidates. Our team will reach out within 3-5 business days with details about the next steps.

We look forward to speaking with you soon!

Best regards,
Hiring Team
"""
    return _send_email_with_retry(to_email, subject, body)

def send_otp_via_email(to_email: str, otp_code: str) -> bool:
    subject = "Your Verification Code - Hiring Platform"
    body = f"""
Dear User,

Your verification code is: {otp_code}

This code will expire in 5 minutes.

If you did not request this code, please ignore this email.

Best regards,
Hiring Team
"""
    return _send_email_with_retry(to_email, subject, body)

def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    frontend_url = os.environ.get("FRONTEND_URL", getattr(settings, 'FRONTEND_URL', 'http://localhost:5173'))
    reset_link = f"{frontend_url}/reset-password?token={reset_token}"
    
    subject = "Password Reset Request - Hiring Platform"
    body = f"""
Dear User,

We received a request to reset your password.

Click the link below to reset your password:
{reset_link}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.

Best regards,
Hiring Team
"""
    return _send_email_with_retry(to_email, subject, body)