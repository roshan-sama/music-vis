FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Clone and install EasyMocap
WORKDIR /app
RUN git clone https://github.com/zju3dv/EasyMocap.git
WORKDIR /app/EasyMocap

# Fix mediapipe version and install
RUN sed -i 's/mediapipe==0.10.0/mediapipe==0.10.13/g' requirements.txt && \
    pip install -r requirements.txt && \
    pip install -e .

WORKDIR /app