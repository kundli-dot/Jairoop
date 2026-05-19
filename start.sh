#!/bin/bash
set -e
echo "╔══════════════════════════════════════════╗"
echo "║    Jai Roop Textiles — IMS V7            ║"
echo "╚══════════════════════════════════════════╝"

# Install deps if needed
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt -q
fi

echo "🚀 Starting IMS server at http://localhost:8000"
echo "   Press Ctrl+C to stop"
echo ""
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
