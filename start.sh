#!/usr/bin/env bash

DEPTH_PORT=8100
NEXT_PORT=3000
HEALTH_TIMEOUT=15

cleanup() {
  echo ""
  echo "Shutting down..."
  [ -n "$DEPTH_PID" ] && kill "$DEPTH_PID" 2>/dev/null
  [ -n "$NEXT_PID" ] && kill "$NEXT_PID" 2>/dev/null
  wait 2>/dev/null
  echo "Done."
}
trap cleanup EXIT

# --- Start depth server ---
echo "Starting depth server on port $DEPTH_PORT..."
VENV_PATH="depthv2/depthv2/bin/activate"
if [ ! -f "$VENV_PATH" ]; then
  echo "ERROR: Python venv not found at $VENV_PATH"
  exit 1
fi

(
  cd depthv2/Depth-Anything-V2
  source ../depthv2/bin/activate
  uvicorn server:app --host 0.0.0.0 --port "$DEPTH_PORT"
) &
DEPTH_PID=$!

# --- Start Next.js frontend ---
echo "Starting frontend on port $NEXT_PORT..."
pnpm dev &
NEXT_PID=$!

# --- Health checks ---
echo "Waiting ${HEALTH_TIMEOUT}s before health checks..."
sleep "$HEALTH_TIMEOUT"

# Check depth server process is still alive
if ! kill -0 "$DEPTH_PID" 2>/dev/null; then
  echo "ERROR: Depth server (PID $DEPTH_PID) exited early."
  exit 1
fi

# Check frontend process is still alive
if ! kill -0 "$NEXT_PID" 2>/dev/null; then
  echo "ERROR: Frontend (PID $NEXT_PID) exited early."
  exit 1
fi

# HTTP health check for depth server
if ! curl -sf --max-time 5 "http://localhost:$DEPTH_PORT/health" > /dev/null; then
  echo "ERROR: Depth server health check failed (http://localhost:$DEPTH_PORT/health)."
  exit 1
fi
echo "Depth server is healthy."

# HTTP health check for frontend
if ! curl -sf --max-time 5 "http://localhost:$NEXT_PORT" > /dev/null; then
  echo "ERROR: Frontend health check failed (http://localhost:$NEXT_PORT)."
  exit 1
fi
echo "Frontend is healthy."

echo ""
echo "All services running:"
echo "  Frontend: http://localhost:$NEXT_PORT"
echo "  Depth:    http://localhost:$DEPTH_PORT"
echo ""

wait
