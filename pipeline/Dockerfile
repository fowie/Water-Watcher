FROM python:3.12-slim

# Install system dependencies for psycopg2 and lxml
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libxml2-dev \
    libxslt-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (optional — skip on failure)
RUN playwright install --with-deps chromium || echo "Playwright install skipped (non-critical)"

# Copy application code
COPY . .

CMD ["python", "main.py"]
