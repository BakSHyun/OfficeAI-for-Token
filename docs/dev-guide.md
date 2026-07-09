# OfficeAI 개발 가이드 (AI 에이전트용)

> **이 문서는 Cursor Auto/Composer 등 AI 어시스턴트가 이 프로젝트를 이어서 개발할 때 반드시 먼저 읽어야 하는 문서다.**
> 아래 규칙을 어기는 변경은 하지 마라. 애매하면 이 문서와 `docs/core-architecture-v2.md`를 다시 읽어라.

---

## 0. 현재 상태 · 문서 지도 (2026-07-07 기준)

**진행 상태:** 카드 A~E 완료, F(패키징)는 아이콘·인스톨러 생성까지 확인. G 카드 **G1~G18·G16(M1~M5) 완료**. 남은 것:
- **G16 M6~M7** (Pro 강화 오버라이드·온라인 결제 — 선택)
- 판매 준비: 코드사이닝(사용자 구매)·키 발급 서버(`docs/roadmap-and-business.md` PART D Phase 1)

**문서 지도 — 작업에 필요한 것만 읽어라 (토큰 절약):**

| 하려는 작업 | 읽을 문서 |
|---|---|
| 모든 개발 작업(공통) | 이 문서 2장(규칙) + 3장(파일 지도) + 해당 카드 명세 |
| UI/컴포넌트/스타일 | `docs/design-guide.md` — 색 토큰·버튼/폼 클래스·체크리스트 |
| 코어 엔진 내부 이해 | `docs/core-architecture-v2.md` |
| 로드맵·우선순위·비즈니스·백엔드 | `docs/roadmap-and-business.md` |
| 직원 마켓(G16) 구현 | `docs/employee-marketplace-plan.md` (M1~M7 카드) |
| 패키징·코드사이닝·크래시 리포팅 | `docs/release-guide.md` |
| 최종 사용자 관점 기능 설명 | `docs/user-guide.md` |

**검증은 항상 4종:** `npm run core:test`(66개+) · `npm run lint` · `npm run build` · (electron 코드 변경 시) `npm run app:build`. PowerShell 5 환경 — 명령 연결은 `;`.

---

## 1. 프로젝트가 무엇인가

OfficeAI는 **토큰 최적화 AI 업무 오케스트레이션 시스템**이다.
사용자가 한 문장으로 지시하면 → Dispatcher가 작업을 WorkUnit DAG로 분해하고 각 유닛에 **딱 필요한 AI 티어(local/economy/standard/premium)** 를 배정 → Executor 노드들이 **동시 실행** → Critic 노드(임원/유저/CFO/CTO 페르소나)가 병렬 검토 → 반려 시 1회 재작업 → 사용자는 **승인 요청만 결정**한다.
Electron으로 Mac/Windows에 설치되는 데스크톱 앱이며, 최종적으로 판매 가능한 제품이 목표다.

---

## 2. 절대 규칙 (위반 금지)

1. **완성된 코어를 다시 만들지 마라.** `core/src/orchestration/`, `core/src/providers/`, `core/src/budget/`, `core/src/telemetry/`는 이미 구현·테스트 완료다. 버그 수정이 아니면 수정 금지. 수정했다면 반드시 `npm run core:test` 통과 확인.
2. **타입을 재선언하지 마라.** 모든 엔진 타입의 단일 출처:
   - 엔진 계약: `core/src/contracts.ts`, `core/src/orchestration/contracts.ts`
   - IPC 계약: `electron/ipc-contract.ts`
   - Renderer는 `src/state/bridge-types.ts` 를 통해서만 위 타입을 import
3. **UI는 이벤트 스트림만 소비한다.** UI 컴포넌트가 엔진 내부를 직접 호출하는 코드를 만들지 마라. 데이터는 전부 `useEngineStore`(zustand)에서 읽고, 액션은 `connectEngine()` 클라이언트로만 보낸다. UI는 Electron 모드와 데모 모드(브라우저)를 구분할 수 없어야 한다.
   - **UI 스타일은 `docs/design-guide.md`를 따른다.** 색 토큰·버튼/배지 클래스·레이아웃 골격의 단일 출처는 `src/styles.css`. 클래스 없는 `<button>`, 리터럴 색상, raw `<svg>`, CSS-in-JS 금지.
4. **개인 정보/경로를 코드에 하드코딩하지 마라.** 로컬 경로·API 키·개인 프로젝트명은 전부 `config/*.local.json`(gitignore됨) 또는 Electron userData에 들어간다. 예시는 `config/*.example.json`에만 추가한다.
5. **API 키를 renderer로 보내지 마라.** 키는 main 프로세스의 `safeStorage`로 암호화 저장하고, renderer에는 존재 여부(`apiKeyPresence`)만 전달한다.
6. **한글로 응답하고, 커밋 메시지는 한 줄 요약 + 한글.** 이모지는 쓰지 않는다.
7. **의존성을 함부로 추가하지 마라.** 이미 설치된 것: react 19, zustand, three, @react-three/fiber, @react-three/drei, lucide-react, better-sqlite3, electron, electron-vite, electron-builder. 새 패키지가 필요하면 그 이유를 사용자에게 먼저 설명하라.
8. **모든 변경 후 검증 실행:**
   ```bash
   npm run core:test   # 코어+로직 테스트 (66개+, 전부 통과해야 함)
   npm run lint        # ESLint
   npm run build       # tsc + vite (타입 오류 검출)
   npm run app:build   # electron/ 코드를 바꿨을 때만 추가 실행
   ```
9. **`.officeai/`, `release/`, `out/`, `dist/`는 절대 커밋하지 마라.**
10. **renderer가 값(value)을 import할 수 있는 비-renderer 코드는 `shared/`뿐이다.** `shared/`에는 Node 내장 모듈(`node:*`) import 금지. Node 전용 로직은 `shared/license-crypto.ts`처럼 별도 파일로 분리해 electron/코어에서만 import한다 (renderer 번들에 node:crypto가 섞이면 빌드가 깨진다).
11. **IPC 채널/타입을 추가하면 반드시 4곳을 함께 수정하라:** `electron/ipc-contract.ts`(정의) → `electron/main.ts`(handle) → `electron/preload.ts`(브리지) → `src/state/bridge-types.ts`(재수출).

---

## 3. 아키텍처와 파일 지도

```
사용자 명령
  → intake/task-intake.ts        (규칙 기반 분류, 0토큰)
  → orchestration/dispatcher.ts  (WorkUnit 분해 + 티어/크리틱 배정, 0토큰)
  → orchestration/orchestrator.ts(DAG 동시 실행 + 재작업 루프)
      ├─ providers/*             (LLM 호출: openai/anthropic/codex-cli/cursor-agent-cli/mock)
      ├─ budget/budget-manager.ts(호출 전 예산 게이트: ok/degrade/block)
      ├─ orchestration/approval-gate.ts (사용자 결정 대기)
      └─ orchestration/event-bus.ts     (모든 상태 변화 발행)
  → telemetry/ledger.ts          (SQLite 기록, 이벤트 구독)
  → electron/main.ts             (엔진 호스팅 + IPC)
  → electron/preload.ts          (window.officeai 브리지)
  → src/state/engine-client.ts   (Electron ↔ 데모 드라이버 자동 전환)
  → src/state/engine-store.ts    (zustand: nodes/runs/activities/approvals/budget/usage)
  → src/App.tsx + components/    (React UI)
```

| 경로 | 역할 | 상태 |
|---|---|---|
| `core/src/engine.ts` | 엔진 조립 팩토리 `createEngine()` | 완성 |
| `core/src/orchestration/contracts.ts` | `RunEvent`, `NodeDescriptor`, `DispatchPlan`, `CriticVerdict` 등 | 완성 |
| `core/src/orchestration/orchestrator.ts` | DAG 스케줄러(동시성 `concurrency`), 크리틱 루프, 예산 연동 | 완성 |
| `core/src/orchestration/dispatcher.ts` | 티어 배정(`routeModel` 재사용), `degradeTier` | 완성 |
| `core/src/orchestration/roles.ts` | 역할/크리틱 프롬프트, `selectCritics`, JSON 스키마 | 완성 (프롬프트 개선은 허용) |
| `core/src/providers/` | `LLMProvider` 구현 5종 + registry | 완성 |
| `core/src/budget/budget-manager.ts` | 전역/run/unit 3계층 예산 | 완성 |
| `core/src/telemetry/ledger.ts` | SQLite + 메모리 폴백 | 완성 |
| `core/src/cli/run.ts` | `npm run core:run -- "지시" --mock` | 완성 |
| `electron/ipc-contract.ts` | IPC 채널·타입 단일 출처 | 완성 |
| `electron/main.ts` / `preload.ts` | 엔진 호스팅, safeStorage, 창 관리 | 완성 (검증: `npm run app:build` 통과) |
| `src/state/engine-store.ts` | RunEvent → UI 상태 리듀서 | 완성 |
| `src/state/engine-client.ts` | 브리지/데모 자동 전환 | 완성 |
| `src/state/demo-driver.ts` | 브라우저용 이벤트 시뮬레이터 | 완성 |
| `src/state/useEngine.ts` | 레거시 컴포넌트 어댑터 훅 | 완성 (UI 개편 시 대체 가능) |
| `src/office3d/character-machine.ts` | 3D 캐릭터 상태 머신 (렌더러 독립) | 완성·테스트됨 |
| `src/office3d/OfficeScene.tsx` | r3f 3D 오피스 씬 (lazy 로딩) | 완성 |
| `src/components/DecisionInbox.tsx` | 결정 인박스 | 완성 |
| `src/components/ProcessView.tsx` | 2D DAG 프로세스 뷰 | 완성 |
| `src/components/SettingsView.tsx` | 설정 (티어/키/동시성) | 완성 |
| `src/components/RunsView.tsx` / `ReportView.tsx` | 업무 관리 / 보고서 | 완성 |
| `src/components/OnboardingModal.tsx` | 온보딩 3단계 | 완성 |
| `src/components/ErrorBoundary.tsx` | 뷰 격리 (3D 크래시 방지) | 완성 |
| `core/src/providers/retry.ts` | 재시도(백오프)+하위 티어 폴백 래퍼 (G2) | 완성 |
| `shared/license-core.ts` | 라이선스 타입·상태 계산 (브라우저 안전) | 완성 |
| `shared/license-crypto.ts` | Ed25519 서명/검증 (Node 전용, main만 import) | 완성 |
| `shared/action-blocks.ts` | 산출물→액션 제안 파서 (G17, 브라우저 안전) | 완성 |
| `electron/action-runner.ts` | 액션 실행: 작업 폴더 격리 파일 쓰기·확인 후 명령 실행 (G17) | 완성 |
| `electron/memory-scan.ts` | 업무 기억 폴더 스캔 (G12) | 완성 |
| `electron/schedules.ts` | 정기 업무 스케줄 판정 (G10) | 완성 |
| `electron/desktop-integration.ts` | 트레이·OS 알림·일시정지 (G6) | 완성 |
| `electron/license-store.ts` / `privacy-store.ts` | 라이선스 상태·프라이버시 설정 저장 (G13·G14) | 완성 |
| `electron/crash-reporting.ts` | opt-in Sentry (G14) | 완성 |
| `electron/diagnostic-export.ts` / `deliverable-export.ts` | 진단 번들(G4)·산출물 저장(G8) | 완성 |
| `scripts/issue-license.ts` | 라이선스 키 발급 (개발자용, 개인키 필요) | 완성 |
| `src/components/DeliverableActions.tsx` | 보고서 산출물 액션 패널 (G17) | 완성 |
| `src/components/KnowledgeView.tsx` | 지식 & 근거 뷰 (기억 상태+산출물 근거) | 완성 |
| `src/components/LicenseSection.tsx` 외 설정 섹션들 | 설정 화면 섹션 (연결 상태/기억/스케줄/프라이버시/3D) | 완성 |
| `src/office3d/CatModel.tsx` + `public/models/Cat.gltf` | glTF 고양이(CC0) + `PrimitiveCat` 폴백 (G11) | 완성 |
| `src/state/use-license-status.ts` / `license-client.ts` | 라이선스 상태 훅 + 데모 모드 | 완성 |

### 이벤트 계약 (UI가 소비하는 것)

`RunEvent` 타입 (`core/src/orchestration/contracts.ts`):
`run:started`, `run:planned`(plan 포함), `node:spawned`, `node:working`, `node:done`, `node:failed`, `node:blocked`, `critic:verdict`, `token:used`, `budget:warning`, `budget:exceeded`, `approval:requested`, `approval:resolved`, `run:completed`(report 포함), `run:failed`.

**새 UI를 만들 때 이 이벤트만 구독하면 된다. 엔진을 몰라도 된다.**

---

## 4. 실행/검증 명령 모음

```bash
npm run dev          # 브라우저 UI (데모 드라이버로 동작, Electron 불필요)
npm run app:dev      # Electron 개발 모드 (실제 엔진 연결)
npm run app:build    # Electron 번들 빌드 (main/preload/renderer)
npm run app:package:win  # Windows NSIS 인스톨러 → release/
npm run app:package:mac  # macOS DMG (Mac에서만 실행 가능)

npm run core:run -- "골프장 예약 기능 기획해줘" --mock  # 엔진 헤드리스 검증 (API 키 불필요)
npm run core:run -- "..."                              # 실제 provider 사용 (providers.local.json 필요)
npm run core:test    # 전체 테스트
```

### provider 설정 (실제 LLM 연결)

`config/providers.example.json`을 `config/providers.local.json`으로 복사 후 수정.
- `tiers.<tier>.provider`: `openai` | `anthropic` | `codex-cli` | `cursor-agent-cli` | `mock`
- `apiKeys.openai`: `"env:OPENAI_API_KEY"` 또는 리터럴 키
- Electron 앱에서는 설정 화면(작업 카드 B)에서 입력 → safeStorage 저장

#### Cursor Agent CLI (`cursor-agent-cli`)

OfficeAI CommandBar에서 지시하면 orchestrator가 내부에서 `agent`(또는 `cursor agent`)를 **비대화형**으로 호출한다. 사용자가 터미널에 직접 입력할 필요 없음.

1. [Cursor Agent CLI](https://cursor.com/docs/cli/overview) 설치 후 `agent login` 1회 실행
2. `config/providers.example.json`처럼 `local`(또는 개발 WorkUnit 티어)에 `"provider": "cursor-agent-cli"` 설정
3. Windows에서 `agent`가 PATH에 없으면 `providers.local.json`에 아래처럼 지정:
   ```json
   "cursorAgentCli": {
     "command": "cursor",
     "commandPrefixArgs": ["agent"]
   }
   ```
   또는 환경변수 `OFFICEAI_CURSOR_AGENT_COMMAND=cursor agent`
4. 검증: `npm run core:run -- "로그인 화면 개선안" --mock` (mock) 또는 mock 없이 실제 호출

`codex-cli`와 `cursor-agent-cli`는 둘 다 로컬 구독 CLI — 티어 하나에 하나만 선택.

#### LM Studio (`lmstudio`) — 로컬 오프라인 모델

[LM Studio](https://lmstudio.ai)는 OpenAI 호환 로컬 서버를 띄운다. API 키·비용 없이 완전 오프라인으로 돌릴 수 있어 `local`/`economy` 티어에 적합하다.

1. LM Studio 실행 → 모델 다운로드 → **Developer(Local Server)** 탭에서 **Start Server** (기본 `http://localhost:1234/v1`)
2. `config/providers.local.json`의 티어에 지정:
   ```json
   "local": {
     "provider": "lmstudio",
     "model": "qwen2.5-7b-instruct",
     "inputCostPerMillion": 0,
     "outputCostPerMillion": 0
   },
   "baseUrls": { "lmstudio": "http://localhost:1234/v1" }
   ```
   또는 앱 설정 화면에서 provider를 `lmstudio`로, model을 LM Studio에 로드된 모델 이름으로 설정.
3. `model`은 LM Studio에 **로드된 모델의 식별자**와 일치해야 한다 (서버 로그/모델 목록에서 확인).
4. API 키는 필요 없다 (내부적으로 placeholder 사용). 포트를 바꿨다면 `baseUrls.lmstudio`만 수정.
5. 검증: LM Studio 서버를 켠 상태에서 `npm run core:run -- "간단 요약 테스트"` (mock 없이).

내부적으로 LM Studio는 OpenAI provider(`createOpenAIProvider`)를 재사용하되 텔레메트리 라벨만 `lmstudio`로 구분한다.

### better-sqlite3 주의

Electron은 Node와 ABI가 달라서 네이티브 모듈 재빌드가 필요할 수 있다:
```bash
npx electron-rebuild -f -w better-sqlite3
```
실패해도 앱은 **메모리 ledger로 폴백**해서 돌아간다 (`core/src/engine.ts` 참고). `npm run core:*` 스크립트가 sqlite 오류를 내면 `npm rebuild better-sqlite3`로 Node용 재빌드.

---

## 5. 작업 카드

각 카드는 독립적으로 작업 가능하다. **완료 기준을 전부 만족하고 검증 3종을 통과해야 완료다.**

### ✅ 완료된 카드 (2026-07-06)

- **카드 A** 결정 인박스(`src/components/DecisionInbox.tsx`) + 2D DAG 뷰(`ProcessView.tsx`) — 완료. NavSidebar "승인 대기"/"에이전트" 연결됨
- **카드 B** 설정 화면(`SettingsView.tsx`) — 완료. 티어 표 + API 키 + concurrency, 데모 모드 안내 포함
- **카드 C** 3D 오피스(`src/office3d/OfficeScene.tsx`) — 완료. 프리미티브 고양이, 상태별 애니메이션, 대시보드 2D/3D 토글, lazy 로딩(`React.lazy`) + `ErrorBoundary` 격리. 브라우저 스모크 테스트 통과
- **카드 D** 업무 관리(`RunsView.tsx`) + 보고서(`ReportView.tsx`) — 완료
- **카드 E** 온보딩(`OnboardingModal.tsx` + `src/state/onboarding.ts`) — 완료. localStorage `officeai.onboarded` 플래그
- `ActivityRail`이 실제 usage/approvals로 구동되도록 교체됨
- `engine-client.ts`에 `subscribeRaw()` 추가됨 (3D 씬용 원시 이벤트 구독)

### 이하 원래 카드 명세 (참고용 — A~E는 완료됨)

### 카드 A — 결정 인박스 + 2D DAG 프로세스 뷰 (난이도: 중)

- 위치: `src/components/` 에 `DecisionInbox.tsx`, `ProcessView.tsx` 신규
- 데이터: `useEngineStore`의 `approvals`, `runs[activeRunId].plan.units`, `nodes`
- DecisionInbox:
  - `approvals` 목록 렌더. `request.kind`별 아이콘/색 (plan-confirm=파랑, budget-escalation=노랑, critic-rejection=주황, side-effect=빨강)
  - `request.payload.units`가 있으면(plan-confirm) 유닛 테이블 표시: title/role/tier/critics
  - 승인/반려 버튼 → `connectEngine().resolveApproval(id, true|false)`
  - NavSidebar "승인 대기" 클릭 시 이 화면으로 전환 (App.tsx의 `activeNav` 활용)
- ProcessView (2D DAG):
  - `plan.units`의 `dependsOn`으로 계층 배치(위상 정렬 후 레벨별 컬럼). 외부 그래프 라이브러리 **추가하지 말고** CSS grid + SVG 연결선으로 구현
  - 각 노드 카드: 유닛명, 역할, 티어 뱃지, 상태(대기/실행중/완료/실패 — `nodes`에서 `workUnitId`로 매칭), 누적 토큰(`usedTokens`)
  - 실행 중 노드는 펄스 애니메이션
- 완료 기준: `npm run dev`에서 명령 입력 → 데모 드라이버의 5개 유닛 DAG가 그려지고 상태가 실시간 변하며, 승인 요청이 인박스에 뜨고 버튼이 동작한다.

### 카드 B — 설정 화면 (난이도: 하)

- 위치: `src/components/SettingsView.tsx` 신규. NavSidebar "설정"과 연결
- 데이터: `window.officeai.getSettings()` / `saveSettings()` (데모 모드에서는 읽기 전용 안내 표시)
- 내용:
  - 티어별 provider/model 표 (4행: local/economy/standard/premium). provider는 select(openai/anthropic/codex-cli/cursor-agent-cli/mock), model은 text input
  - API 키 입력 필드 2개 (openai/anthropic). `apiKeyPresence`가 true면 "저장됨 ••••" 표시, 새 값 입력 시에만 전송
  - 동시 실행 수(concurrency) 숫자 입력
  - 저장 버튼 → `saveSettings({ providers, apiKeys })` → 성공 토스트
- 완료 기준: Electron(`npm run app:dev`)에서 키 저장 후 앱 재시작해도 유지(`apiKeyPresence` true), 데모 모드에선 안내문이 보인다.

### 카드 C — 3D 오피스 씬 (난이도: 중상, 재미요소)

- 위치: `src/office3d/OfficeScene.tsx` 신규. 기존 `OfficeCanvas`(2D)와 토글 전환 (App.tsx에 view 상태 추가)
- **로직은 이미 있다**: `src/office3d/character-machine.ts`의 `createCharacterMachine()`이 이벤트→캐릭터 상태/좌표를 전부 계산한다. **씬은 렌더만 하라.**
- 구현 방법:
  1. `useRef`로 machine 인스턴스 생성, `useEngineStore.subscribe` 대신 `connectEngine()` 후 store의 이벤트를 machine에 전달해야 하므로 — `engine-client.ts`의 `onEvent` 경로에 machine을 끼울 수 있게 `src/office3d/useCharacters.ts` 훅을 만들어라: store가 아닌 원시 RunEvent가 필요하므로 `window.officeai.onEvent` 또는 데모 드라이버 emit을 직접 구독 (engine-client에 `subscribeRaw(listener)` API를 추가하는 것을 허용한다 — 단 ipc-contract는 건드리지 말 것)
  2. `useFrame((_, delta) => { machine.tick(delta * 1000); machine.prune(); })`
  3. 캐릭터: glTF 에셋 없이 시작 — 캡슐(몸) + 구(머리) + 원뿔 귀 2개 = 고양이 프리미티브. 색은 `tier`별 (local=회색, economy=초록, standard=파랑, premium=보라)
  4. 상태 표현: `working`=책상 앞 위아래 미세 bobbing, `celebrating`=제자리 회전+점프, `coffee`=커피머신 옆 정지, `waiting-approval`=사용자 책상 앞 좌우 흔들림, `blocked`=머리 위 빨간 `!` 스프라이트
  5. 말풍선: `@react-three/drei`의 `Html`로 `character.speech` 표시 (12자 초과 시 말줄임)
  6. 사무실: 바닥 plane + 책상 box들(`defaultLayout.desks` 좌표) + 커피머신 + 사용자 책상. 캐릭터 클릭 시 `onSelect(nodeId)` 콜백 → TaskInspector에 해당 노드 표시
  7. 카메라: `OrthographicCamera` 아이소메트릭 각도 + `OrbitControls` (줌/회전 제한)
- 완료 기준: `npm run dev` 데모 모드에서 명령 입력 → 고양이들이 입장→책상 이동→작업→축하→커피→퇴근 사이클을 수행. 성능: 캐릭터 15마리에서 60fps 근처.

### 카드 D — 업무 관리/보고서 뷰 (난이도: 하)

- NavSidebar "업무 관리": `runs` 목록 테이블 (명령, 상태, 토큰, 비용, 시작 시각). Electron 모드에서는 `window.officeai.recentRuns()`로 과거 이력 병합
- "보고서": run 선택 시 `report.deliverables` 마크다운 렌더 (의존성 추가 없이 단순 pre/줄바꿈 처리 또는 이미 있는 방식 재사용), Critic 점수 뱃지 표시
- 완료 기준: 데모 run 완료 후 두 화면에서 결과가 보인다.

### 카드 E — 온보딩 플로우 (난이도: 하)

- 첫 실행 감지: `getSettings()`의 `apiKeyPresence`가 전부 false이고 티어가 전부 mock이면 온보딩 모달 표시
- 3단계: (1) 환영 + 개념 1장 설명 → (2) API 키 입력 (또는 "Codex CLI 사용" / "데모로 둘러보기" 선택) → (3) 첫 명령 예시 3개 버튼
- 완료 기준: userData 초기화 후 앱 실행 시 온보딩이 뜨고, 완료하면 다시 안 뜬다 (localStorage 플래그).

### 카드 F — 패키징 마무리 (난이도: 중, **사용자 확인 필요**)

- `build/` 폴더에 앱 아이콘 (icon.ico 256px, icon.icns) — 아이콘 이미지는 사용자에게 요청
- `npm run app:package:win` 실행 → `release/*.exe` 생성 확인 → 설치 → 실행 → 명령 제출까지 스모크 테스트
- 자동 업데이트는 G3에서 구현됨 (`electron/auto-update.ts`, GitHub Releases)
- 완료 기준: 인스톨러로 설치한 앱에서 mock 티어로 명령 1건이 완료된다.

### 작업 순서 권장

~~A → B → D → C → E~~ (완료) → **F(패키징) → 6장 제품화 백로그(G 카드)**

---

## 5.5 제품화 백로그 — "판매 가능한 프로그램"까지의 갭

유저 입장에서 **간편함·안정성·특별한 경험**이 판매의 조건이다. 아래 G 카드는 그 갭을 메우는 순서대로 정렬되어 있다. 각 카드는 카드 A~F와 같은 규칙(완료 기준 + 검증)을 따른다.

> **G 카드 현황:** ✅ G1~G18·G16(M1~M5) 완료 — 아래 완료 카드 명세는 참고용이니 다시 구현하지 마라. ⏳ 선택: G16 M6(Pro 강화), M7(온라인 결제).

### 우선순위 1 — 안정성 (없으면 환불감)

**G1. 실행 복구/이어보기 (난이도: 중)**
- 문제: 앱을 껐다 켜면 진행 중이던 run 상태가 UI에서 사라진다 (ledger에는 이벤트가 남아 있음)
- 구현: Electron main 기동 시 `engine.ledger.recentRuns(5)`에서 `status='running'`인 run을 `failed`(사유: "앱 종료로 중단")로 마킹. renderer 첫 로드 시 `recentRuns` + `runEvents(runId)`를 재생해 store를 복원하는 `hydrateFromLedger()` 함수를 `engine-client.ts`에 추가
- 완료 기준: run 완료 후 앱 재시작 → 업무 관리/보고서에 이전 run이 그대로 보인다

**G2. LLM 호출 재시도 + 오프라인 대응 (난이도: 중)**
- 위치: `core/src/providers/registry.ts`의 `resolveTier` 반환 provider를 재시도 래퍼로 감싼다 (새 파일 `core/src/providers/retry.ts`)
- 규칙: 429/5xx/네트워크 오류 → 지수 백오프 2회 재시도(1s, 4s) → 실패 시 한 단계 하위 티어로 1회 폴백 → 그래도 실패면 `node:failed`. 4xx(인증)는 재시도 없이 즉시 `approval:requested`(kind: side-effect 아님 — 새 kind `config-error`를 contracts에 추가 금지, reason 텍스트로 안내)
- 완료 기준: 테스트에서 가짜 provider가 2회 실패 후 성공하는 시나리오 통과 (`core/tests/`에 추가)

**G3. 자동 업데이트 (✅ 완료, 2026-07-08)**
- `electron-updater` + `electron/auto-update.ts` — 패키징된 앱에서 GitHub Releases 확인(기동 시 + 4시간 주기), 다운로드 완료 시 `UpdateBanner`로 "재시작하여 업데이트" (강제 아님)
- IPC: `update:get-status` / `update:install` / `update:status-changed` (ipc-contract → main/preload/bridge-types)
- `electron-builder.yml` `publish`: GitHub `BakSHyun/OfficeAI-for-Token`
- 개발 모드·`OFFICEAI_DISABLE_AUTO_UPDATE=1`에서는 비활성. **코드사이닝 없이 배포하면 Windows SmartScreen 경고가 뜰 수 있음** (`docs/release-guide.md`)

**G4. 진단 번들 내보내기 (난이도: 하)**
- 설정 화면에 "진단 파일 내보내기" 버튼: 최근 이벤트 로그(개인정보 redaction 적용, `core/src/security/redaction.ts` 재사용) + 버전/OS 정보를 zip이 아닌 단일 `.json`으로 저장 대화상자
- 완료 기준: 내보낸 파일에 API 키/시크릿 패턴이 없다

### 우선순위 2 — 편의 (매일 쓰게 만드는 것)

**G5. 명령 히스토리 + 추천 (난이도: 하)**
- CommandBar에서 ↑/↓로 이전 명령 탐색(localStorage 최근 20개), 입력 중 최근 명령 dropdown
- 자주 쓰는 명령 별표 → 온보딩 예시 자리에 표시
- 완료 기준: 재시작 후에도 히스토리 유지

**G6. OS 알림 + 트레이 (난이도: 중)**
- main 프로세스에서 `run:completed`/`approval:requested` 이벤트 시 Electron `Notification` 발송 (창이 포커스 없을 때만). 클릭 시 창 포커스 + 해당 뷰로 이동 (IPC로 nav 명령 push — `ipc-contract.ts`에 `navigateTo` 채널 추가 허용)
- 트레이 아이콘: 대기 승인 수 뱃지, 우클릭 메뉴(열기/일시정지/종료)
- 완료 기준: 창 최소화 상태에서 승인 요청 → 알림 클릭 → 결정 인박스가 열린다

**G7. 예산 설정 UI + KRW 표시 (난이도: 하)**
- 설정 화면에 일일 토큰 한도, 환율(수동 입력, 기본 1400) 필드 → `saveSettings`의 providers에 싣지 말고 새 `budget` 섹션으로 (main에서 `createEngine`의 `budget` 옵션으로 전달, userData `budget.json` 저장)
- UI 전반의 $ 표시 옆에 ₩ 병기 (`formatCost()` 유틸을 `src/state/`에 추가)
- 완료 기준: 한도를 낮게 설정하면 실행 시 `budget:warning` 배지가 UI에 뜬다

**G8. 산출물 내보내기 (난이도: 하)**
- ReportView 각 산출물에 "복사" / "MD 파일로 저장" 버튼 (Electron `dialog.showSaveDialog`는 IPC 채널 추가 필요 — `ipc-contract.ts`에 `exportDeliverable` 추가 허용. 데모 모드는 클립보드 복사만)
- 완료 기준: 저장한 .md 파일이 산출물 전문을 담는다

### 우선순위 3 — 차별화 (사는 이유)

**G9. 토큰 절약 리포트 (난이도: 중) — 핵심 셀링포인트**
- 아이디어: "전부 premium으로 돌렸다면 $X였지만 스마트 배정으로 $Y — Z% 절약"
- 구현: ledger `usage` 테이블에서 run별 (input+output)×premium 단가로 가상 비용 계산 vs 실제 비용. `ReportView` 하단과 대시보드 usage 패널에 절약 배지 표시. IPC `usageTotals`를 확장하지 말고 새 채널 `savingsSummary` 추가 허용
- 완료 기준: mock run 후 절약 % 가 표시된다

**G10. 정기 업무 스케줄러 (난이도: 중상)**
- "매일 아침 9시에 오늘 할 일 브리핑" 같은 반복 실행. main 프로세스에 단순 interval 체크(분 단위) + userData `schedules.json`
- UI: 업무 관리 탭에 "정기 업무" 섹션 (명령, cron 아닌 단순 요일+시각 선택)
- 주의: 실행 전 조용히 시작하되 결과는 알림으로. 예산 게이트는 그대로 적용됨
- 완료 기준: 1분 뒤로 예약한 업무가 자동 실행되고 알림이 온다

**G11. 3D 오피스 고도화 (난이도: 중, 재미)**
- 무료 glTF 고양이 모델 도입(라이선스 CC0 확인, `public/models/`), 애니메이션 클립(walk/sit/dance) 매핑
- 완료/실패 사운드 이펙트 (설정에서 끄기 가능, 기본 off)
- 클릭한 캐릭터 따라다니는 카메라 모드
- 완료 기준: 기존 상태 머신 테스트가 그대로 통과 (로직 변경 금지, 렌더만 교체)

**G12. 로컬 업무 기억 연동 UI (난이도: 중)**
- 기존 `core:scan`(Cursor/Git/Obsidian 스캐너)을 앱에서 실행: 설정에 "업무 기록 폴더 연결" → 폴더 선택 → main에서 스캔 실행 → "OO건의 업무 기록을 학습했습니다"
- 효과: 명령 시 자기 업무 맥락이 자동 포함되는 것이 이 제품의 두 번째 차별점
- 완료 기준: 폴더 연결 후 명령을 내리면 맥락냥 산출물에 해당 폴더 내용이 인용된다

### 우선순위 4 — 판매 준비

**G13. 라이선스/활성화 (판매 방식 결정 후)** — 라이선스 키 검증(오프라인 서명 검증 방식 권장), 체험 모드(mock 티어 무제한 + API 티어 N회)
**G14. 코드사이닝 + 크래시 리포팅** — Windows EV 인증서/Apple notarization은 사용자가 구매해야 함(보고할 것). 크래시 리포팅은 opt-in Sentry
**G15. 웹사이트/문서** — 랜딩 페이지, 사용 설명서, 데모 GIF(3D 오피스가 최고의 마케팅 소재)

**G16. AI 직원 마켓플레이스 (M1~M5 ✅ 2026-07-08)** — `docs/employee-marketplace-plan.md` 참고.
- ✅ M1: `shared/employees.ts`, `employee-catalog.ts`, `entitlement.ts` + 테스트
- ✅ M2: `LicensePayload.employees`, 다중 키 `license.json`, `scripts/issue-license.ts --employees`
- ✅ M3: IPC `employees:catalog|entitlement|set-active|changed`
- ✅ M4: `MarketplaceView`, `TeamRosterSection`, 네비 「직원 마켓」
- ✅ M5: `EmployeeGateBanner` + `ProcessView` 미보유 배지 (실행은 차단하지 않음)
- ⏳ M6: Pro 강화 `createEngine` 옵션 주입 / M7: 온라인 결제

> **전체 완성도 진단 · 향후 로드맵(실행 액션/컨텍스트 압축/MCP/Skills/Hooks/프로젝트 관리) · 비즈니스 모델 · 백엔드 전략은 `docs/roadmap-and-business.md` 참고.** 신규 기능 착수 시 그 문서의 우선순위(PART E)를 기준으로 G/M 카드로 분해할 것.

### 우선순위 5 — 제품 핵심 확장 (roadmap-and-business.md PART B)

**G17. 실행 액션 러너 v1 (✅ 완료, 2026-07-07)** — 산출물에서 실행 가능한 액션을 감지해 사용자가 원클릭으로 수행.
- 감지: `shared/action-blocks.ts`의 `parseActionProposals()` — (1) ` ```officeai-action ` 펜스의 JSON(`write-file`/`run-command`), (2) 펜스 info `path=`/`file=` 속성, (3) 펜스 위 "파일: 경로" 라벨. 경로 탈출(`..`/절대경로/드라이브)은 파서와 러너에서 이중 차단
- 실행: `electron/action-runner.ts` — 사용자가 선택한 **액션 작업 폴더**(userData `action-workspace.json`) 안에서만 파일 쓰기, 셸 명령은 실행 직전 **네이티브 확인 대화상자** 강제, 120초 타임아웃, 실행 이력은 userData `action-log.jsonl`
- IPC: `actions:execute` / `actions:get-workspace` / `actions:choose-workspace` (main/preload/renderer 3곳 동시 수정됨)
- UI: `src/components/DeliverableActions.tsx` — ReportView 산출물 카드 하단 액션 패널. 데모 모드는 표시만(실행 불가 안내)
- 코어 미변경. 테스트: `core/tests/action-blocks.test.ts`, `core/tests/action-runner.test.ts`
- v2 후보: git 커밋/HTTP 액션 타입 추가, 명령 화이트리스트 설정, 실행 이력 UI

**G18. 컨텍스트 압축/장기기억 (✅ 완료, 2026-07-08)** — `docs/roadmap-and-business.md` B-2 참고.
- ✅ 1단계: `electron/run-summaries.ts` — run 완료 시 규칙 기반 요약을 userData `run-summaries.jsonl`에 저장, 다음 `submitCommand` 시 최근 3건을 `[최근 업무 맥락]` 블록으로 명령 앞에 첨부
- ✅ 2단계: `core/src/context/hierarchical-summary.ts` + `electron/run-summary-llm.ts` + `electron/project-summary-llm.ts` + `electron/project-summaries.ts` — economy 티어로 유닛→run→프로젝트 계층 압축, `project-summaries.json` 저장, 다음 명령에 `[프로젝트 맥락]` 첨부. LLM 실패 시 규칙 요약 폴백 (`summaryMethod: rule|llm`). 프로젝트 추론은 `inferProjectHints`(work-profile) 재사용

### G 카드 공통 주의

- IPC 채널 추가가 필요한 카드(G6, G8, G9)는 반드시 `electron/ipc-contract.ts`에 채널·타입을 먼저 추가하고 main/preload/renderer 세 곳을 같이 수정하라
- 새 kind/타입을 core contracts에 추가하는 것은 G 카드 범위에서 금지 (orchestrator 재테스트 필요해짐). UI/Electron 레이어에서 해결하라
- localStorage 키는 `officeai.` 접두사 사용

---

## 6. 코드 스타일

- TypeScript strict. `any` 금지 (`unknown` + 좁히기)
- 함수형 컴포넌트 + 훅. 클래스 컴포넌트 금지
- 상태는 zustand store 하나(`engine-store.ts`)에 집중. 컴포넌트 로컬 UI 상태만 `useState`
- CSS는 `src/styles.css`의 기존 변수/클래스 재사용 (다크 테마). CSS-in-JS 라이브러리 추가 금지
- 주석은 "왜"만 적는다. 코드를 반복 설명하는 주석 금지
- 파일명: 컴포넌트 PascalCase.tsx, 로직 kebab-case.ts
- import 순서: node 내장 → 외부 패키지 → 내부 상대경로

## 7. 문제 발생 시

| 증상 | 원인/해결 |
|---|---|
| `tsc` 오류가 core/electron 파일에서 남 | renderer(src)에서 core를 **타입만** import해야 함. 값 import 금지 (`import type`) |
| Electron 창은 뜨는데 이벤트가 안 옴 | preload 경로 확인 (`out/preload/preload.mjs`), DevTools 콘솔에서 `window.officeai` 존재 확인 |
| better-sqlite3 ABI 오류 | 4장 참고. 앱은 메모리 폴백으로 계속 동작함 |
| codex-cli provider가 exit 1 | `codex` 로그인/설정 확인. 티어를 mock으로 바꾸면 우회 가능 |
| cursor-agent-cli provider가 exit 1 | `agent login` 또는 `cursor agent login` 실행. PATH에 `agent` 없으면 `cursorAgentCli`/`OFFICEAI_CURSOR_AGENT_COMMAND` 설정 |
| PowerShell에서 `&&` 오류 | 이 환경은 PowerShell 5 — `;`로 명령 연결 |
| 데모 드라이버만 동작하고 실제 엔진 안 붙음 | 브라우저(`npm run dev`)에선 정상. 실제 엔진은 `npm run app:dev`에서만 |
