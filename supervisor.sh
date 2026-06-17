#!/bin/bash
# supervisor.sh — run.js가 죽거나 네트워크로 끊겨도 자동 재시작 (연속성 보장).
# 자격증명은 start.sh에서 상속받거나, 없으면 키체인에서 로드. DONE 플래그 생기면 종료.
cd "$(dirname "$0")"
source ./load-creds.sh 2>/dev/null   # env 비어있으면 키체인에서 채움
SESSION="session.log"
stamp() { date '+%Y-%m-%d %H:%M:%S'; }

if [ -z "$EDU_ID" ] || [ -z "$EDU_PW" ]; then
  echo "[$(stamp)] 자격증명 없음 → supervisor 종료" >> "$SESSION"; exit 1
fi

echo "[$(stamp)] ===== supervisor 시작 (pid $$) =====" >> "$SESSION"
trap 'echo "[$(stamp)] supervisor 신호 수신 → 종료" >> "$SESSION"; exit 0' INT TERM

while true; do
  if [ -f DONE ]; then
    echo "[$(stamp)] DONE 감지 → supervisor 정상 종료" >> "$SESSION"
    break
  fi
  rm -f chrome-profile/Singleton* 2>/dev/null
  echo "[$(stamp)] run.js 기동" >> "$SESSION"
  node run.js
  code=$?
  echo "[$(stamp)] run.js 종료 (exit=$code) → 10초 후 재시작" >> "$SESSION"
  sleep 10
done
