"""
Firebase Cloud Function entry point — wraps the Flask app from option_api.py
Lazy-loads heavy deps (yfinance, pandas, scipy) to avoid init timeout.
"""
from firebase_functions import https_fn, options

_app = None

def _get_app():
    global _app
    if _app is None:
        from option_api import app
        _app = app
    return _app

@https_fn.on_request(
    region="us-central1",
    memory=1024,
    timeout_sec=120,
    max_instances=2,
    min_instances=0,
    cors=options.CorsOptions(cors_origins="*", cors_methods=["GET"])
)
def yahoo_options_svc(req: https_fn.Request) -> https_fn.Response:
    app = _get_app()
    with app.request_context(req.environ):
        return app.full_dispatch_request()
