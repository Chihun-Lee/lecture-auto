#!/bin/bash
# load-creds.sh — 환경변수에 자격증명이 없으면 macOS 키체인에서 로드. (start.sh / supervisor.sh 가 source)
SERVICE="edukisa-auto"
if [ -z "$EDU_ID" ] || [ -z "$EDU_PW" ]; then
  if security find-generic-password -s "$SERVICE" >/dev/null 2>&1; then
    EDU_ID=$(security find-generic-password -s "$SERVICE" 2>/dev/null | awk -F'"' '/"acct"/{print $4}')
    EDU_PW=$(security find-generic-password -s "$SERVICE" -w 2>/dev/null)
  fi
fi
export EDU_ID EDU_PW
