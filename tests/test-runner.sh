#!/bin/bash
# Test Runner Script
# Usage: ./test-runner.sh [--all|--test_name FILE]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "${SCRIPT_DIR}/.." && pwd)"
TESTS_DIR="${SCRIPT_DIR}"
PID_FILE="/tmp/.http-server.pid"

cleanup() {
    echo "Stopping server (PID: $PID)..."
    kill -9 "$PID" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "Cleanup complete"
}

start() {
    echo "Starting server from ${REPO}/src..."
    cd "${REPO}/src" && python3 -m http.server 8080 >/dev/null 2>&1 &
    PID=$!
    cd "${REPO}"
    echo "$PID" > "$PID_FILE"
    #sleep 1
}

run_tests() {
    local test_files=""
    
    if [[ "$1" == "--test_name" || "$1" == "-t" ]]; then
        test_files="$2"
    elif [[ "$1" == "--all" || -z "$1" ]]; then
        test_files=""  # Run all tests
    else
        test_files="$1"  # Treat as file path
    fi
    
    echo "Running tests..."
    if [[ -z "$test_files" ]]; then
        cd "${TESTS_DIR}" && npm test 2>&1
    else
        cd "${TESTS_DIR}" && npm test -- "$test_files" 2>&1
    fi
    return $?
}

# Handle arguments
case "$1" in
    --all|"")
        start
        run_tests
        ;;
    --test_name|-t)
        start
        run_tests "$@"
        ;;
    *)
        # Assume it's a test file path
        start
        run_tests "$1"
        ;;
esac

# Cleanup
cleanup
exit $?
