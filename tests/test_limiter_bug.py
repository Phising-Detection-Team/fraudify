from flask import Flask
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)
app.config['RATELIMIT_ENABLED'] = False
limiter = Limiter(get_remote_address)
limiter.init_app(app)

with app.app_context():
    print(limiter.enabled)
