# lecture_auto_portable — edukisa 강의 자동 수강 (포터블)

다른 맥북에 **폴더만 복사**하면 되는 버전. 비밀번호를 파일에 저장하지 않고 **실행 시 직접 입력**합니다.
(원하면 그 맥북의 macOS 키체인에 저장 → 다음부터 입력 생략)

headless Chrome로 각 차시 영상을 **실시간 끝까지 재생 → 100% → 다음 차시** 자동 진행.
감시자(supervisor)가 크래시·네트워크 끊김 시 자동 재시작·재로그인·이어보기 → **불안정한 인터넷에서도 연속 수강**.

## 다른 컴퓨터에서 — 터미널에 한 줄

```bash
curl -fsSL https://raw.githubusercontent.com/Chihun-Lee/lecture-auto/main/bootstrap.sh | bash
```

끝입니다. 이 한 줄이 알아서:
1. Node.js / Google Chrome 점검 (없으면 Homebrew로 설치 시도)
2. 코드를 `~/lecture-auto` 로 내려받고 의존성 설치
3. **아이디/비밀번호를 직접 입력**받아(비번은 화면에 안 보임) 수강 시작

- 비밀번호는 디스크에 평문 저장 안 함 → 실행 프로세스 메모리에서만 사용.
- "키체인에 저장" 선택 시 그 컴퓨터의 macOS 키체인(`edukisa-auto`)에 저장 → 다음부터 입력 생략.
- 두 번째 실행부터는 같은 한 줄이면 최신 코드로 갱신 후 이어서 진행.

> Homebrew가 없고 Node/Chrome도 없으면 설치 링크를 안내합니다. (대부분의 맥북은 그대로 동작)

## 사용

```bash
./start.sh                 # 시작/재개
tail -f progress.log       # 진행상황
cat schedule.md            # 차시 완료 스케줄표
cat session.log            # 시작/종료/오류 기록
cat status.json            # 실시간 상태(마지막 생존시각·현재 차시·%)
open captures/             # 캡처된 슬라이드
./stop.sh                  # 중지 (※ kill 금지 — 진도 보존하려면 꼭 stop.sh)
./forget-creds.sh          # 키체인에 저장한 자격증명 삭제
```

## 다른 강의에 쓰려면
강의 URL이 다르면(다른 과정/계정), 시작 시 URL을 지정:
```bash
COURSE_URL="https://corp.edukisa.or.kr/service/em/page/my_class_std.do?...." ./start.sh
```
미지정 시 `run.js`의 기본 URL(현재 과정)을 사용합니다.

## 동작 / 주의
- 진도는 사이트가 **체크포인트에만 저장** → 중간에 강제 `kill` 하면 마지막 저장 지점으로 되돌아갑니다. 반드시 `./stop.sh`.
- 차시당 약 30분, 전체 수 시간 소요(백그라운드 방치).
- **시험은 자동 응시하지 않습니다**(응시 횟수 소모 방지). 시험이 열리면 `progress.log`에 `⚠ 시험 응시 가능`이 남고, `status.json`이 `blocked_exam`이 됩니다 → 직접 응시하세요.

## 파일
- `run.js` 수강 로직 / `supervisor.sh` 감시자 / `load-creds.sh` 자격증명 로드
- `setup.sh` 설치 / `start.sh` 시작 / `stop.sh` 중지 / `forget-creds.sh` 키체인 삭제
