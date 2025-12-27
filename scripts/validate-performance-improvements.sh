#!/usr/bin/env bash

################################################################################
# Script de validation des corrections de performance
# Exécute Artillery avec configuration optimisée et compare avec baseline
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Validation des Corrections de Performance ===${NC}\n"

# Check if baseline exists
BASELINE_FILE="artillery-report-load-1000.json"
if [ ! -f "$BASELINE_FILE" ]; then
  echo -e "${YELLOW}⚠️  Baseline file not found: $BASELINE_FILE${NC}"
  echo "Using default baseline metrics:"
  BASELINE_VUSERS=172
  BASELINE_429s=128
  BASELINE_THROUGHPUT=2
  BASELINE_FINISH_P99=1023
else
  echo "✓ Baseline found: $BASELINE_FILE"
  BASELINE_VUSERS=$(jq -r '.aggregate.counters["vusers.created"]' "$BASELINE_FILE")
  BASELINE_429s=$(jq -r '.aggregate.counters["http.codes.429"] // 0' "$BASELINE_FILE")
  BASELINE_THROUGHPUT=$(jq -r '.aggregate.rps.mean // 2' "$BASELINE_FILE")
  BASELINE_FINISH_P99=$(jq -r '.aggregate.latency.p99 // 1023' "$BASELINE_FILE")
fi

echo -e "\n${YELLOW}Baseline Metrics:${NC}"
echo "  VUsers Created: $BASELINE_VUSERS"
echo "  HTTP 429 Count: $BASELINE_429s"
echo "  Throughput: ${BASELINE_THROUGHPUT} req/s"
echo "  /finish P99: ${BASELINE_FINISH_P99}ms"

echo -e "\n${YELLOW}Current Configuration:${NC}"
echo "  MAX_ACTIVE_REQUESTS: ${MAX_ACTIVE_REQUESTS:-200 (default)}"
echo "  MAX_CONCURRENT_FINALIZATION_JOBS: ${MAX_CONCURRENT_FINALIZATION_JOBS:-8 (default)}"

# Start backend with optimized config using Docker
echo -e "\n${GREEN}Starting backend with optimized configuration (Docker)...${NC}"

# Create temporary .env file with optimized config
cat > .env.perf-test <<EOF
NODE_ENV=development
PORT=3000
CONTENT_ROOT=/content
ASSETS_ROOT=/assets
UI_ROOT=/ui
LOGGER_LEVEL=${LOGGER_LEVEL:-info}
ALLOWED_ORIGINS=*
API_KEY=test-api-key-for-artillery
MAX_ACTIVE_REQUESTS=${MAX_ACTIVE_REQUESTS:-200}
MAX_CONCURRENT_FINALIZATION_JOBS=${MAX_CONCURRENT_FINALIZATION_JOBS:-8}
EOF

echo "Configuration:"
echo "  MAX_ACTIVE_REQUESTS=${MAX_ACTIVE_REQUESTS:-200}"
echo "  MAX_CONCURRENT_FINALIZATION_JOBS=${MAX_CONCURRENT_FINALIZATION_JOBS:-8}"

# Stop any existing containers
echo "Stopping any existing containers..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v 2>/dev/null || true

# Start with optimized config
echo "Starting Docker containers..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.perf-test up --build -d --remove-orphans --force-recreate

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
for i in {1..60}; do
  if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend ready!${NC}"
    break
  fi
  if [ $i -eq 60 ]; then
    echo -e "${RED}✗ Backend failed to start after 60s${NC}"
    echo "Docker logs:"
    docker compose -f docker-compose.yml -f docker-compose.dev.yml logs --tail=50
    docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
    rm -f .env.perf-test
    exit 1
  fi
  sleep 1
done

# Capture initial health metrics
echo -e "\n${YELLOW}Initial Health Metrics:${NC}"
curl -s http://localhost:3000/health | jq -r '.load | "  activeRequests: \(.activeRequests)\n  eventLoopLagMs: \(.eventLoopLagMs)\n  memoryUsageMB: \(.memoryUsageMB)\n  rejections.total: \(.rejections.total)"'

# Run Artillery test
echo -e "\n${GREEN}Running Artillery load test...${NC}"
REPORT_FILE="artillery-report-optimized-$(date +%Y%m%d-%H%M%S).json"

if artillery run artillery-load-test.yml --output "$REPORT_FILE"; then
  echo -e "${GREEN}✓ Artillery test completed${NC}"
else
  echo -e "${RED}✗ Artillery test failed${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
fi

# Capture final health metrics
echo -e "\n${YELLOW}Final Health Metrics:${NC}"
curl -s http://localhost:3000/health | jq -r '.load | "  activeRequests: \(.activeRequests)\n  eventLoopLagMs: \(.eventLoopLagMs)\n  memoryUsageMB: \(.memoryUsageMB)\n  rejections: \(.rejections)"'

# Analyze results
echo -e "\n${GREEN}=== Performance Analysis ===${NC}\n"

OPTIMIZED_VUSERS=$(jq -r '.aggregate.counters["vusers.created"]' "$REPORT_FILE")
OPTIMIZED_429s=$(jq -r '.aggregate.counters["http.codes.429"] // 0' "$REPORT_FILE")
OPTIMIZED_THROUGHPUT=$(jq -r '.aggregate.rps.mean' "$REPORT_FILE")
OPTIMIZED_FINISH_P99=$(jq -r '.aggregate.latency.p99' "$REPORT_FILE")

echo "Metrics Comparison:"
echo "┌─────────────────────────────────────┬──────────────┬──────────────┬───────────┐"
echo "│ Metric                              │ Baseline     │ Optimized    │ Change    │"
echo "├─────────────────────────────────────┼──────────────┼──────────────┼───────────┤"

# VUsers
VUSERS_CHANGE=$(echo "scale=1; (($OPTIMIZED_VUSERS - $BASELINE_VUSERS) / $BASELINE_VUSERS) * 100" | bc)
printf "│ %-35s │ %12s │ %12s │ %8s%% │\n" "VUsers Created" "$BASELINE_VUSERS" "$OPTIMIZED_VUSERS" "$VUSERS_CHANGE"

# 429s
if [ "$BASELINE_429s" -gt 0 ]; then
  CODE_429_CHANGE=$(echo "scale=1; (($OPTIMIZED_429s - $BASELINE_429s) / $BASELINE_429s) * 100" | bc)
else
  CODE_429_CHANGE=0
fi
printf "│ %-35s │ %12s │ %12s │ %8s%% │\n" "HTTP 429 Count" "$BASELINE_429s" "$OPTIMIZED_429s" "$CODE_429_CHANGE"

# Throughput
THROUGHPUT_CHANGE=$(echo "scale=1; (($OPTIMIZED_THROUGHPUT - $BASELINE_THROUGHPUT) / $BASELINE_THROUGHPUT) * 100" | bc)
printf "│ %-35s │ %10s/s │ %10s/s │ %8s%% │\n" "Throughput (req/s)" "$BASELINE_THROUGHPUT" "$OPTIMIZED_THROUGHPUT" "$THROUGHPUT_CHANGE"

# P99 Latency
FINISH_P99_CHANGE=$(echo "scale=1; (($OPTIMIZED_FINISH_P99 - $BASELINE_FINISH_P99) / $BASELINE_FINISH_P99) * 100" | bc)
printf "│ %-35s │ %10sms │ %10sms │ %8s%% │\n" "/finish P99 Latency" "$BASELINE_FINISH_P99" "$OPTIMIZED_FINISH_P99" "$FINISH_P99_CHANGE"

echo "└─────────────────────────────────────┴──────────────┴──────────────┴───────────┘"

# Validation criteria
echo -e "\n${YELLOW}Validation Criteria:${NC}"
PASS_COUNT=0
FAIL_COUNT=0

# Check VUsers improvement (expected: +28% = 172 → 220)
if (( $(echo "$VUSERS_CHANGE >= 20" | bc -l) )); then
  echo -e "  ${GREEN}✓${NC} VUsers improved by ${VUSERS_CHANGE}% (target: +20%)"
  ((PASS_COUNT++))
else
  echo -e "  ${RED}✗${NC} VUsers improved by ${VUSERS_CHANGE}% (target: +20%)"
  ((FAIL_COUNT++))
fi

# Check 429s reduction (expected: -30% to -40%)
if (( $(echo "$CODE_429_CHANGE <= -25" | bc -l) )); then
  echo -e "  ${GREEN}✓${NC} 429s reduced by ${CODE_429_CHANGE}% (target: -25%)"
  ((PASS_COUNT++))
else
  echo -e "  ${RED}✗${NC} 429s reduced by ${CODE_429_CHANGE}% (target: -25%)"
  ((FAIL_COUNT++))
fi

# Check throughput improvement (expected: 2x = 2 → 4 req/s)
if (( $(echo "$THROUGHPUT_CHANGE >= 80" | bc -l) )); then
  echo -e "  ${GREEN}✓${NC} Throughput improved by ${THROUGHPUT_CHANGE}% (target: +80%)"
  ((PASS_COUNT++))
else
  echo -e "  ${RED}✗${NC} Throughput improved by ${THROUGHPUT_CHANGE}% (target: +80%)"
  ((FAIL_COUNT++))
fi

# Check P99 latency reduction (expected: -40% = 1023 → 600ms)
if (( $(echo "$FINISH_P99_CHANGE <= -30" | bc -l) )); then
  echo -e "  ${GREEN}✓${NC} P99 latency reduced by ${FINISH_P99_CHANGE}% (target: -30%)"
  ((PASS_COUNT++))
else
  echo -e "  ${RED}✗${NC} P99 latency reduced by ${FINISH_P99_CHANGE}% (target: -30%)"
  ((FAIL_COUNT++))
fi

# Final verdict
echo -e "\n${YELLOW}Final Verdict:${NC}"
echo "  Passed: ${PASS_COUNT}/4"
echo "  Failed: ${FAIL_COUNT}/4"

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "\n${GREEN}🎉 All performance targets met!${NC}"
  EXIT_CODE=0
elif [ $PASS_COUNT -ge 2 ]; then
  echo -e "\n${YELLOW}⚠️  Partial improvement - some targets not met${NC}"
  EXIT_CODE=0
else
  echo -e "\n${RED}❌ Performance targets not met${NC}"
  EXIT_CODE=1
fi

# Save report
echo -e "\n${YELLOW}Report saved to: $REPORT_FILE${NC}"
echo "View detailed report with: npm run load:report:open ${REPORT_FILE%.json}"

# Check backend logs for errors
echo -e "\n${YELLOW}Backend Log Summary:${NC}"
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs --tail=20 | grep -E "ERROR|WARN" || echo "  No errors/warnings found"

# Cleanup
echo -e "\n${YELLOW}Cleaning up...${NC}"
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
rm -f .env.perf-test
echo -e "${GREEN}✓ Cleanup complete${NC}"

exit $EXIT_CODE
