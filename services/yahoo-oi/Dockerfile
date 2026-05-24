FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run injects PORT env var (default 8080)
ENV PORT=8080

# gunicorn with 1 worker + 4 threads:
# - yfinance is not fully thread-safe but the cache layer serializes Yahoo calls
# - 4 threads lets Cloud Run send up to 4 concurrent requests to one instance
# - Cache hits are served instantly without hitting Yahoo
# - Cloud Run concurrency should be set to 10 (most requests hit cache)
CMD exec gunicorn --bind :$PORT --workers 1 --threads 4 --timeout 120 option_api:app
