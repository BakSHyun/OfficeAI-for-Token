# Office AI Command Center

한 문장으로 업무를 지시하면 통괄(Orchestrator)-분배(Dispatcher)-실행(Executor)-비판(Critic: 임원/유저/CFO/CTO) 노드 AI가 작업을 DAG로 분해해 동시 실행하고, 유닛마다 딱 필요한 모델 티어를 배정해 토큰을 최적화하는 AI 업무 오케스트레이션 시스템입니다. Electron으로 Mac/Windows에 설치됩니다.

> **개발을 이어서 하려면 먼저 `docs/dev-guide.md`를 읽으세요.** 남은 작업 카드와 규칙이 정리되어 있습니다.

- [사용 설명서](docs/user-guide.md)
- [배포·코드사이닝 가이드](docs/release-guide.md)
- [랜딩 페이지](website/index.html) (정적 HTML)

## 실행

```bash
npm install
npm run dev        # 브라우저 UI (데모 이벤트 드라이버)
npm run app:dev    # Electron 앱 (실제 오케스트레이션 엔진)
npm run core:run -- "골프장 예약 기능 기획해줘" --mock   # 엔진 헤드리스 실행
npm run core:test  # 코어 테스트
```

프로덕션 빌드는 `npm run build`(웹) / `npm run app:package:win|mac`(설치본), 정적 검사는 `npm run lint`.

LLM 연결은 `config/providers.example.json`을 `config/providers.local.json`으로 복사해 티어별 provider(openai/anthropic/codex-cli/cursor-agent-cli/mock)와 API 키를 설정합니다.

## 코어 실행

```bash
npm run core:scan
npm run core:context -- "KCP 결제 정산 관련 작업" 2400
npm run core:plan -- "최근 작업을 파악하고 다음 개발 계획을 작성해줘"
npm run core:route
npm run core:test
```

`core:scan`은 `config/sources.local.json`의 Cursor, Git, Obsidian 경로를 읽기 전용으로 스캔하고 secret redaction을 거쳐 `.officeai/work-events.jsonl`과 현재 업무 추정치인 `.officeai/work-profile.json`을 만듭니다. 이 파일과 로컬 경로 설정은 Git에서 제외됩니다.

전체 설계는 `docs/core-architecture-v2.md`를 기준으로 합니다. Codex 실행 어댑터는 연결되어 있으며, 실제 실행 전 모델 티어별 모델/프로필 매핑을 설정해야 합니다.

## gtsn 개발 자동화

```bash
npm run dev:auto -- probe
npm run dev:auto -- baseline
npm run dev:auto -- prepare "gtsn-backend와 gtsn-admin의 다음 변경 계획을 준비해줘"
npm run dev:auto -- plan "변경 계획을 검토해줘"
OFFICEAI_ALLOW_APPLY=1 npm run dev:auto -- apply "승인된 계획대로 구현해줘"
npm run dev:auto -- verify
```

`probe`는 저장소/도구 연결을 확인하고, `baseline`은 현재 HEAD의 기존 검증 실패를 기록합니다. `prepare`는 로컬 이력에서 Context Pack과 검증 계획을 만들며 코드를 수정하지 않습니다. `plan`과 `apply`는 모델 티어별 Codex 모델 또는 프로필 환경변수가 설정된 경우에만 실행됩니다.

macOS 설정은 `docs/macos-setup.md`를 참고합니다.
