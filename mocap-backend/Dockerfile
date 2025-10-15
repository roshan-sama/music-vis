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
    wget \
    && rm -rf /var/lib/apt/lists/*

# Clone and install EasyMocap
WORKDIR /app
RUN git clone https://github.com/zju3dv/EasyMocap.git
WORKDIR /app/EasyMocap

# Fix mediapipe version
RUN sed -i 's/mediapipe==0.10.0/mediapipe==0.10.13/g' requirements.txt

# Fix PyTorch 2.6 weights_only issue + CPU-only machine for SPIN model loading
RUN sed -i "270s/torch\.load(checkpoint)/torch.load(checkpoint, map_location=torch.device('cpu'), weights_only=False)/" \
    easymocap/estimator/SPIN/spin_api.py

# Fix tensor/numpy type mismatch in mirror.py
RUN sed -i '127s/center \* normal/center * normal.cpu().numpy()/' \
    easymocap/multistage/mirror.py

# Install dependencies
RUN pip install -r requirements.txt && \
    pip install -e . && \
    pip install pyrender pillow

WORKDIR /app