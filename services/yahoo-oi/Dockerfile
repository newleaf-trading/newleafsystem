FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run injects PORT env var (default 8080)
ENV PORT=8080

# gunicorn for production — single worker since yfinance is not thread-safe
CMD exec gunicorn --bind :$PORT --workers 1 --threads 1 --timeout 120 option_api:app
