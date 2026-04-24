#!/bin/bash

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting StockX Academic Presentation Mode...${NC}"

# Kill any existing processes on the ports we need
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo -e "${GREEN}1. Starting Backend (FastAPI)...${NC}"
cd backend
# Check if virtual environment exists, if not, create it
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    echo "Installing backend dependencies..."
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    cp .env.example .env
fi

# Run backend in background
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

echo -e "${GREEN}2. Starting Frontend (React/Vite)...${NC}"
cd frontend
# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    cp .env.example .env
fi

# Run frontend
npm run dev
