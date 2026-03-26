import os
import requests
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
import json

class OAuthHandler:
    def __init__(self):
        # Allow insecure transport for local development
        if os.environ.get('FLASK_ENV') == 'development':
            os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

class GoogleOAuthHandler(OAuthHandler):
    # Depending on client_secrets.json or env variables
    SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
    
    def __init__(self):
        super().__init__()
        self.client_id = os.environ.get('GOOGLE_CLIENT_ID')
        self.client_secret = os.environ.get('GOOGLE_CLIENT_SECRET')
        self.redirect_uri = os.environ.get('GOOGLE_REDIRECT_URI', 'http://localhost:3000/api/auth/callback/google')
        
    def get_authorization_url(self):
        client_config = {
            "web": {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [self.redirect_uri]
            }
        }
        try:
            flow = Flow.from_client_config(
                client_config, 
                scopes=self.SCOPES,
                redirect_uri=self.redirect_uri
            )
            # Offline access ensures we get a refresh token
            auth_url, _ = flow.authorization_url(prompt='consent', access_type='offline')
            return auth_url
        except Exception as e:
            print(f"Failed to generate Google auth URL: {e}")
            return None

    def exchange_code(self, code):
        client_config = {
            "web": {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [self.redirect_uri]
            }
        }
        try:
            flow = Flow.from_client_config(
                client_config, 
                scopes=self.SCOPES,
                redirect_uri=self.redirect_uri
            )
            flow.fetch_token(code=code)
            credentials = flow.credentials
            
            return {
                'access_token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'expiry': credentials.expiry.isoformat() if credentials.expiry else None
            }
        except Exception as e:
            print(f"Failed to exchange Google code: {e}")
            return None

    def refresh_access_token(self, refresh_token):
        client_config = {
            "web": {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        }
        try:
            creds = Credentials(
                None,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=self.client_id,
                client_secret=self.client_secret
            )
            from google.auth.transport.requests import Request
            creds.refresh(Request())
            return {
                'access_token': creds.token,
                'expiry': creds.expiry.isoformat() if creds.expiry else None
            }
        except Exception as e:
            print(f"Failed to refresh Google token: {e}")
            return None


class OutlookOAuthHandler(OAuthHandler):
    # MS Graph scopes
    SCOPES = ['Mail.Read', 'offline_access']
    AUTHORITY = "https://login.microsoftonline.com/common"
    
    def __init__(self):
        super().__init__()
        self.client_id = os.environ.get('OUTLOOK_CLIENT_ID')
        self.client_secret = os.environ.get('OUTLOOK_CLIENT_SECRET')
        self.redirect_uri = os.environ.get('OUTLOOK_REDIRECT_URI', 'http://localhost:3000/api/auth/callback/outlook')
        
    def get_authorization_url(self):
        # Simplified generation of auth URL
        scope_str = " ".join(self.SCOPES)
        auth_url = (f"{self.AUTHORITY}/oauth2/v2.0/authorize"
                    f"?client_id={self.client_id}"
                    f"&response_type=code"
                    f"&redirect_uri={self.redirect_uri}"
                    f"&response_mode=query"
                    f"&scope={scope_str}")
        return auth_url

    def exchange_code(self, code):
        token_url = f"{self.AUTHORITY}/oauth2/v2.0/token"
        scope_str = " ".join(self.SCOPES)
        
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': self.redirect_uri,
            'scope': scope_str
        }
        
        try:
            response = requests.post(token_url, data=data)
            if response.status_code == 200:
                result = response.json()
                return {
                    'access_token': result.get('access_token'),
                    'refresh_token': result.get('refresh_token'),
                    # Outlook doesn't give expiry in isoformat directly, but as expires_in seconds
                    'expires_in': result.get('expires_in')
                }
            else:
                print(f"Failed to exchange Outlook code. Status: {response.status_code}, Response: {response.text}")
                return None
        except Exception as e:
            print(f"Exception exchanging Outlook code: {e}")
            return None

    def refresh_access_token(self, refresh_token):
        token_url = f"{self.AUTHORITY}/oauth2/v2.0/token"
        
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'scope': " ".join(self.SCOPES)
        }
        
        try:
            response = requests.post(token_url, data=data)
            if response.status_code == 200:
                result = response.json()
                return {
                    'access_token': result.get('access_token'),
                    'refresh_token': result.get('refresh_token'), # it might return a new one
                    'expires_in': result.get('expires_in')
                }
            else:
                print(f"Failed to refresh Outlook token. Status: {response.status_code}")
                return None
        except Exception as e:
            print(f"Exception refreshing Outlook token: {e}")
            return None

