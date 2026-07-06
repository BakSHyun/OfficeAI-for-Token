# Obsidian을 사람 확인 장기기억으로 쓰는 규칙

현재 볼트의 Markdown가 1개이므로 Obsidian은 아직 보조 신호다. 다음 구조를 사용하면 자동 생성 이력과 사용자가 확인한 결정을 분리할 수 있다.

```text
Obsidian Vault/
  Projects/
    gtsn-backend.md
    gtsn-admin.md
    kiosk.md
  Decisions/
    2026-07-06-kcp-reconcile-policy.md
  Daily/
    2026-07-06.md
  AI Inbox/
    자동 생성 초안.md
  Archive/
```

## 프로젝트 노트

```md
---
type: project
project: gtsn-backend
status: active
owners: [me]
updated: 2026-07-06
source_refs:
  - gtsn-backend:git:COMMIT_HASH
---

# 현재 목표

# 진행 중

# 최근 결정

# 알려진 위험

# 다음 행동
```

## 결정 기록

```md
---
type: decision
project: gtsn-backend
status: accepted
decided_at: 2026-07-06
confidence: high
source_refs: []
supersedes: []
---

# 결정

# 이유

# 검토한 대안

# 다시 검토할 조건
```

## 운영 규칙

- `AI Inbox`는 AI가 작성할 수 있지만 다른 폴더로 자동 승격하지 않는다.
- 사용자가 승인한 노트만 `Projects`와 `Decisions`에 저장한다.
- Markdown 본문보다 frontmatter의 `project`, `type`, `status`, `source_refs`를 먼저 검색한다.
- 결정이 바뀌면 기존 노트를 삭제하지 않고 `supersedes`로 연결한다.
- secret, 고객 개인정보, API key는 볼트와 인덱스 모두에 저장하지 않는다.
