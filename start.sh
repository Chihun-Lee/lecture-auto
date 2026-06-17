#!/bin/bash
# start.sh — 아이디/비번을 직접 입력받아(또는 키체인에서 로드) 자동 수강 시작.
# 비밀번호는 디스크에 평문 저장하지 않음. (원하면 macOS 키체인에 저장)
cd "$(dirname "$0")"
SERVICE="edukisa-auto"

# 의존성 미설치 시 안내
if [ ! -d node_modules/playwright-core ]; then
  echo "의존성이 없습니다. 먼저 ./setup.sh 를 실행하세요."; exit 1
fi

# 키체인에 저장돼 있으면 로드, 아니면 직접 입력
if security find-generic-password -s "$SERVICE" >/dev/null 2>&1; then
  source ./load-creds.sh
  echo "키체인에서 자격증명 로드: $EDU_ID"
else
  # curl|bash 로 실행돼도 동작하도록 터미널(/dev/tty)에서 직접 입력받음
  read -p "edukisa 아이디: " EDU_ID </dev/tty
  read -s -p "비밀번호: " EDU_PW </dev/tty; echo
  export EDU_ID EDU_PW
  read -p "이 컴퓨터 키체인에 저장할까요? (다음부터 입력 생략) [y/N]: " SAVE </dev/tty
  if [[ "$SAVE" =~ ^[Yy] ]]; then
    security add-generic-password -a "$EDU_ID" -s "$SERVICE" -w "$EDU_PW" -U && echo "키체인에 저장됨 (서비스명: $SERVICE)"
  fi
fi

if [ -z "$EDU_ID" ] || [ -z "$EDU_PW" ]; then echo "✗ 자격증명이 비었습니다."; exit 1; fi

# (선택) 다른 강의 URL을 쓰려면: export COURSE_URL="..." 후 실행. 미설정 시 run.js 기본값 사용.
rm -f DONE 2>/dev/null
nohup bash supervisor.sh >/dev/null 2>&1 &
echo $! > supervisor.pid
echo "수강 시작됨 (supervisor pid $(cat supervisor.pid))"
echo "  진행상황:  tail -f progress.log"
echo "  스케줄표:  cat schedule.md"
echo "  세션기록:  cat session.log"
echo "  중지:      ./stop.sh"
