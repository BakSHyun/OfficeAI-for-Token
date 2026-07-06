# macOS 실행 가이드

OfficeAI 코어에는 Windows 전용 경로와 PowerShell 명령을 넣지 않았다. 프로세스 실행은 Windows에서만 `cmd.exe` 어댑터를 사용하고 macOS/Linux에서는 실행 파일을 직접 호출한다.

## 요구 사항

- macOS 13+
- Node.js 20 이상
- Git
- PHP 8.2 이상과 Composer
- Codex CLI
- Cursor 기록을 사용할 경우 Cursor

```bash
node --version
git --version
php --version
composer --version
codex --version
```

## 저장소 경로

```bash
export GTSN_BACKEND_ROOT="$HOME/dev/app/gtsn-backend"
export GTSN_ADMIN_ROOT="$HOME/dev/app/gtsn-admin"
```

`config/repositories.example.json`을 `config/repositories.local.json`으로 복사한다. 환경변수가 있으면 후보 경로보다 우선한다.

## 로컬 업무 소스

```bash
cp config/sources.macos.example.json config/sources.local.json
```

일반적인 Cursor 경로:

- plans/transcripts: `~/.cursor/`
- workspace metadata: `~/Library/Application Support/Cursor/User/workspaceStorage`

Obsidian과 저장소 위치는 사용자 환경에 맞게 수정한다.

## 설치와 연결 확인

```bash
npm install
npm run core:scan
npm run dev:auto -- probe
npm run dev:auto -- baseline
npm run dev:auto -- prepare "최근 작업을 파악하고 다음 개발 계획을 작성해줘"
```

`.officeai/` 인덱스는 Windows에서 복사하지 않고 Mac에서 다시 생성하는 것이 안전하다. source reference에 로컬 절대 경로가 포함되기 때문이다.

## 모델 티어 연결

라우터의 `economy`, `standard`, `premium` 티어와 Codex 모델 또는 프로필을 명시적으로 연결한다.

```bash
export OFFICEAI_CODEX_MODEL_ECONOMY="<economy-model-id>"
export OFFICEAI_CODEX_MODEL_STANDARD="<standard-model-id>"
export OFFICEAI_CODEX_MODEL_PREMIUM="<premium-model-id>"
```

모델 ID는 설치된 Codex에서 실제 사용 가능한 값으로 설정해야 한다. 설정이 없으면 `plan`과 `apply`는 실행하지 않고 오류를 반환한다.

## 코드 변경과 검증

읽기 전용 계획:

```bash
npm run dev:auto -- plan "gtsn-backend 결제 로직 변경 계획을 작성해줘"
```

코드 변경은 호출 단위로 잠금을 해제해야 한다.

```bash
OFFICEAI_ALLOW_APPLY=1 npm run dev:auto -- apply "승인된 계획대로 구현해줘"
```

Codex는 `workspace-write` sandbox로 실행된다. push, merge, deploy, 외부 전송은 프롬프트 정책상 금지된다.
`apply`는 각 저장소의 현재 HEAD에 해당하는 baseline이 없으면 실행되지 않는다.

변경 후 검증:

```bash
npm run dev:auto -- verify
```

- backend: 변경 PHP 파일 `php -l`, 변경된 test 파일만 `php artisan test <file>`
- admin: TypeScript/React 변경 시 `npm run lint`, `npm run build`

관련 테스트를 자동으로 특정하지 못하면 전체 테스트를 임의 실행하지 않고 manual check로 남긴다.
