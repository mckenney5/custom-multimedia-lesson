#!/usr/bin/env bash
# Test Runner Script
# Usage: ./test-runner.sh [--all|--test_name FILE]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "${SCRIPT_DIR}/.." && pwd)"
TESTS_DIR="${SCRIPT_DIR}"
PID_FILE="/tmp/.http-server.pid"
SERVER_LOG="/tmp/.http-server.log"

# Background jobs (dev server, test run) get their own process group, so the
# signal path below can tear down the whole subtree instead of orphaning it.
set -m

# Tear down whatever this run started, however it ends (normal exit, failure,
# Ctrl+C, SIGTERM) — a run that dies without releasing port 8080 would make
# every later run fail with a misleading "port in use" error.
cleanup() {
	if [ -n "${REUSED:-}" ]; then
		echo "Leaving the server that was already running on port 8080 alone."
	elif [ -n "${PID:-}" ]; then
		echo "Stopping server on port 8080..."
		# the listener is the node child of $PID (the npm wrapper)
		kill $(lsof -ti:8080) 2>/dev/null || true
		kill "$PID" 2>/dev/null || true
	else
		echo "This run started no server; port 8080 left untouched."
	fi
	if [ -n "${TEST_PID:-}" ] && kill -0 "$TEST_PID" 2>/dev/null; then
		kill -- "-$TEST_PID" 2>/dev/null || kill "$TEST_PID" 2>/dev/null || true
	fi
	rm -f "$PID_FILE"
	echo "Cleanup complete"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Report why the suite cannot start. Teardown happens in the EXIT trap.
# Only a server we started has output to show, so a port conflict does not
# print an empty log section.
fail_server() {
	echo "ERROR: $1" >&2
	if [ -n "${PID:-}" ] && [ -s "$SERVER_LOG" ]; then
		echo "--- last server output (${SERVER_LOG}) ---" >&2
		tail -n 20 "$SERVER_LOG" >&2
	fi
	exit 1
}

start() {
	echo "Starting server from ${REPO}/src..."

	if lsof -ti:8080 >/dev/null 2>&1; then
		# Reuse a server that already serves this app (the documented dev
		# server, or a leftover from a killed run): failing here would poison
		# every later run, and killing it would break the developer's session.
		if curl -s --max-time 2 http://localhost:8080/lessons/course_data.json | grep -q '"pages"'; then
			echo "Reusing the server already listening on port 8080."
			REUSED=1
			return 0
		fi
		fail_server "port 8080 is held by a process that does not serve ${REPO}/src; stop it with: lsof -ti:8080 | xargs kill"
	fi

	: > "$SERVER_LOG"
	npx serve "${REPO}/src" -p 8080 --no-clipboard --no-port-switching -L -n >"$SERVER_LOG" 2>&1 &
	PID=$!
	echo "$PID" > "$PID_FILE"

	# Wait up to 30s wall time; each probe is bounded to 2s so a listener
	# that accepts but never answers cannot hang the runner
	deadline=$((SECONDS + 30))
	while [ "$SECONDS" -lt "$deadline" ]; do
		if curl -s --max-time 2 http://localhost:8080/ >/dev/null 2>&1; then
			return 0
		fi
		kill -0 "$PID" 2>/dev/null || fail_server "serve exited during startup"
		sleep 0.5
	done
	fail_server "dev server not ready within 30s"
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
		(cd "${TESTS_DIR}" && npm test 2>&1) &
	else
		(cd "${TESTS_DIR}" && npm test -- "$test_files" 2>&1) &
	fi
	TEST_PID=$!
	wait "$TEST_PID"
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

# Cleanup runs through the EXIT trap; the test run's status must survive it
TEST_STATUS=$?
exit $TEST_STATUS
