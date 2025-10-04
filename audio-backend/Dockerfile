# Audio Analysis Container
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    libsndfile1-dev \
    libaubio5 \
    libaubio-dev \
    gcc \
    g++ \
    make \
    pkg-config \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy analysis scripts
COPY audio_analysis.py .

# Create data directory for mounted volume
RUN mkdir -p /app/data

# Set data directory as working directory for convenience
WORKDIR /app/data

# Uncomment if you want to keep container running
#CMD ["tail", "-f", "/dev/null"]