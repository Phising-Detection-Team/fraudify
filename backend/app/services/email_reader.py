from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import base64
import requests
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from app.utils.encryption import decrypt_token

class BaseEmailReader:
    def __init__(self, encrypted_access_token: str, encrypted_refresh_token: Optional[str] = None, scope: str = 'read'):
        self.access_token = decrypt_token(encrypted_access_token)
        self.refresh_token = decrypt_token(encrypted_refresh_token) if encrypted_refresh_token else None
        self.scope = scope

    def fetch_recent_emails(self, limit: int = 10) -> List[Dict[str, Any]]:
        raise NotImplementedError("Subclasses must implement this method")

class GmailReader(BaseEmailReader):
    def __init__(self, encrypted_access_token: str, encrypted_refresh_token: Optional[str] = None, scope: str = 'read'):
        super().__init__(encrypted_access_token, encrypted_refresh_token, scope)
        # Assuming we don't have client_id etc here to auto-refresh natively,
        # but if we did, we could use that. Let's start with what we have.
        self.creds = Credentials(token=self.access_token, refresh_token=self.refresh_token)
        self.service = build('gmail', 'v1', credentials=self.creds)

    def fetch_recent_emails(self, limit: int = 10) -> List[Dict[str, Any]]:
        results = self.service.users().messages().list(userId='me', maxResults=limit).execute()
        messages = results.get('messages', [])
        
        parsed_emails = []
        for msg in messages:
            msg_data = self.service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
            
            headers = msg_data.get('payload', {}).get('headers', [])
            subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), 'No Subject')
            sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), 'Unknown Sender')
            
            # Simple timestamp fallback, this should be parsed more carefully from InternalDate
            internal_date = int(msg_data.get('internalDate', 0)) / 1000.0
            timestamp = datetime.utcfromtimestamp(internal_date)

            body = self._parse_parts(msg_data.get('payload', {}))
            
            parsed_emails.append({
                'source_id': msg['id'],
                'subject': subject,
                'sender': sender,
                'body': body,
                'timestamp': timestamp.isoformat(),
                'provider': 'gmail',
                'flagged_for_training': self.scope == 'read_and_train'
            })
            
        return parsed_emails

    def _parse_parts(self, payload: dict) -> str:
        """Recursively parses email payload to extract body text."""
        body = ""
        if payload.get('mimeType') == 'text/plain' and 'data' in payload.get('body', {}):
            try:
                data = payload['body']['data']
                body = base64.urlsafe_b64decode(data).decode('utf-8')
            except Exception:
                pass
        elif payload.get('mimeType') == 'text/html' and 'data' in payload.get('body', {}):
            try:
                data = payload['body']['data']
                body = base64.urlsafe_b64decode(data).decode('utf-8')
            except Exception:
                pass
        
        if 'parts' in payload:
            for part in payload['parts']:
                body += self._parse_parts(part) + "\n"
                
        return body.strip()

class OutlookReader(BaseEmailReader):
    GRAPH_ENDPOINT = "https://graph.microsoft.com/v1.0/me/messages"
    
    def fetch_recent_emails(self, limit: int = 10) -> List[Dict[str, Any]]:
        headers = {
            'Authorization': f'Bearer {self.access_token}',
            'Accept': 'application/json'
        }
        params = {
            '$top': limit,
            '$select': 'id,subject,body,sender,receivedDateTime',
            '$orderby': 'receivedDateTime desc'
        }
        
        response = requests.get(self.GRAPH_ENDPOINT, headers=headers, params=params)
        
        if response.status_code != 200:
            print(f"Error fetching Outlook emails: {response.text}")
            return []
            
        data = response.json()
        messages = data.get('value', [])
        
        parsed_emails = []
        for msg in messages:
            # Graph API returns ISO8601 strings for receivedDateTime
            timestamp_str = msg.get('receivedDateTime')
            
            body_content = msg.get('body', {}).get('content', '')
            
            sender_email = msg.get('sender', {}).get('emailAddress', {}).get('address', 'Unknown Sender')
            
            parsed_emails.append({
                'source_id': msg.get('id'),
                'subject': msg.get('subject', 'No Subject'),
                'sender': sender_email,
                'body': body_content,
                'timestamp': timestamp_str,
                'provider': 'outlook',
                'flagged_for_training': self.scope == 'read_and_train'
            })
            
        return parsed_emails

def get_email_reader(provider: str, encrypted_access_token: str, encrypted_refresh_token: Optional[str] = None, scope: str = 'read') -> BaseEmailReader:
    if provider == 'gmail':
        return GmailReader(encrypted_access_token, encrypted_refresh_token, scope)
    elif provider == 'outlook':
        return OutlookReader(encrypted_access_token, encrypted_refresh_token, scope)
    else:
        raise ValueError(f"Unknown provider: {provider}")
