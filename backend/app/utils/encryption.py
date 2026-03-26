import os
import base64
import hashlib
import hmac
from cryptography.fernet import Fernet
from typing import Optional

# In production, ALWAYS set this in your environment variables. 
# It must be a 32-byte url-safe base64-encoded URL-safe string.
# Example to generate one for your .env file: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
_secret_key = os.environ.get('ENCRYPTION_KEY')

if not _secret_key:
    # Fallback for development ONLY to prevent crashing. 
    # Tokens encrypted with this random key WILL become unreadable upon server restart!
    print("WARNING: ENCRYPTION_KEY env var not set. Using a temporary key. Tokens will be unrecoverable on restart.")
    _secret_key = Fernet.generate_key().decode('utf-8')

_cipher_suite = Fernet(_secret_key.encode('utf-8'))

_email_hash_secret = os.environ.get('EMAIL_HASH_SECRET') or _secret_key

def encrypt_token(plain_text: Optional[str]) -> Optional[str]:
    """Encrypts a plaintext string to an encrypted ciphertext string."""
    if not plain_text:
        return plain_text
    
    encoded_text = plain_text.encode('utf-8')
    cipher_text = _cipher_suite.encrypt(encoded_text)
    return cipher_text.decode('utf-8')

def decrypt_token(cipher_text: Optional[str]) -> Optional[str]:
    """Decrypts an encrypted ciphertext string back to plaintext."""
    if not cipher_text:
        return cipher_text
        
    try:
        encoded_cipher = cipher_text.encode('utf-8')
        plain_text = _cipher_suite.decrypt(encoded_cipher)
        return plain_text.decode('utf-8')
    except Exception as e:
        print(f"Failed to decrypt token. Error: {e}")
        # Depending on security logic, you might want to raise an exception here instead.
        return None


def hash_email(email: Optional[str]) -> Optional[str]:
    """Returns a deterministic HMAC-SHA256 hash for email-like values."""
    if not email:
        return email

    if email.startswith('sha256:'):
        return email

    normalized = email.strip().lower()
    digest = hmac.new(
        _email_hash_secret.encode('utf-8'),
        normalized.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()
    return f'sha256:{digest}'
