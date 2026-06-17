#!/bin/bash
# bootstrap.sh — 한 줄 설치/실행 진입점.
# 사용:  curl -fsSL https://raw.githubusercontent.com/Chihun-Lee/lecture-auto/main/bootstrap.sh | bash
# 동작: Node/Chrome 점검(없으면 brew로 설치 시도) → 코드 받기 → 의존성 설치 → 아이디/비번 입력받아 시작.
set -e
REPO_URL="https://github.com/Chihun-Lee/lecture-auto.git"
DIR="${LECTURE_AUTO_DIR:-$HOME/lecture-auto}"

echo "== lecture-auto 부트스트랩 =="

# 1) Node 확인 (없으면 brew로 설치 시도)
if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then echo "· Node.js 설치 중..."; brew install node;
  else echo "✗ Node.js 필요 → https://nodejs.org 설치 후 다시 실행"; exit 1; fi
fi
echo "· node $(node -v)"

# 2) Chrome 확인 (없으면 brew로 설치 시도)
if [ ! -d "/Applications/Google Chrome.app" ]; then
  if command -v brew >/dev/null 2>&1; then echo "· Google Chrome 설치 중..."; brew install --cask google-chrome;
  else echo "✗ Google Chrome 필요 → https://www.google.com/chrome 설치 후 다시 실행"; exit 1; fi
fi
echo "· Google Chrome OK"

# 3) 코드 받기/갱신
if [ -d "$DIR/.git" ]; then echo "· 기존 코드 갱신($DIR)"; git -C "$DIR" pull --ff-only || true;
else echo "· 코드 내려받기 → $DIR"; git clone --depth 1 "$REPO_URL" "$DIR"; fi
cd "$DIR"

# 4) 의존성 설치
echo "· 의존성 설치(playwright-core)"
npm install --no-audit --no-fund

chmod +x *.sh 2>/dev/null || true

# 5) 시작 (터미널에서 ID/PW 입력 → 안내 따라가면 됨)
echo
exec bash start.sh </dev/tty
