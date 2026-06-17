#!/bin/bash
# setup.sh — 새 맥북에서 1회 실행. 의존성 설치 + 환경 점검.
cd "$(dirname "$0")"
echo "== 환경 점검 =="

if ! command -v node >/dev/null 2>&1; then
  echo "✗ Node.js 가 없습니다. https://nodejs.org 에서 설치(또는 'brew install node') 후 다시 실행하세요."
  exit 1
fi
echo "✓ node $(node -v)"

if [ ! -d "/Applications/Google Chrome.app" ]; then
  echo "✗ Google Chrome 가 필요합니다. https://www.google.com/chrome 에서 설치 후 다시 실행하세요."
  exit 1
fi
echo "✓ Google Chrome 설치됨"

echo "== 의존성 설치 (playwright-core) =="
npm install --no-audit --no-fund || { echo "✗ npm install 실패"; exit 1; }

chmod +x start.sh stop.sh supervisor.sh setup.sh 2>/dev/null
echo
echo "✓ 설치 완료. 이제 ./start.sh 로 수강을 시작하세요 (아이디/비번 직접 입력)."
