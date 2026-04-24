FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
# Ensure Hugging Face models are saved in the app directory for Spaces
ENV HF_HOME /app/.cache/huggingface 

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc g++ libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
# Install PyTorch CPU specifically to keep image size smaller
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Create cache directory and set permissions for Hugging Face Spaces (runs as non-root user 1000)
RUN mkdir -p /app/.cache/huggingface && chmod -R 777 /app/.cache

# Copy application code
COPY . .

# Set permissions for the working directory
RUN chmod -R 777 /app

# Create a non-root user (Hugging Face Spaces requirement)
RUN useradd -m -u 1000 user
USER user

# Expose port 7860 (Hugging Face Spaces requirement)
EXPOSE 7860

# Run FastAPI server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
