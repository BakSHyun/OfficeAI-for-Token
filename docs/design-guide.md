# OfficeAI 디자인 가이드 (AI 에이전트용)

> **UI 요소를 만들거나 고치기 전에 반드시 이 문서를 읽어라.** 새 컴포넌트/버튼/배지를 만들 때 여기 없는 스타일을 임의로 만들지 말고, 아래 토큰과 기존 클래스를 재사용하라.
> 단일 출처는 `src/styles.css`다. 이 문서는 그 요약이며, 값이 충돌하면 `styles.css`가 우선한다.

---

## 0. 절대 규칙

1. **인라인 style로 색/여백/폰트를 넣지 마라.** 유일한 예외: 진행 바 너비처럼 런타임 계산이 필요한 값(`style={{ width: \`${ratio}%\` }}`).
2. **하드코딩 색상(`#xxxxxx`, `rgba(...)`)을 컴포넌트/신규 CSS에 새로 쓰지 마라.** 아래 CSS 변수를 써라. styles.css 안에서 기존에 리터럴로 박힌 값들은 유지하되, 새 규칙은 변수 우선.
3. **CSS-in-JS 라이브러리, styled-components, Tailwind 등을 추가하지 마라.** 스타일은 전부 `src/styles.css`의 클래스로 관리한다.
4. **버튼을 만들 때 클래스 없이 `<button>`을 쓰지 마라.** 반드시 아래 버튼 클래스 중 하나를 붙여라.
5. 아이콘은 `lucide-react`만 사용한다. raw `<svg>`를 직접 붙이지 마라.
6. 새 클래스명은 기존 네이밍(`kebab-case`, 컴포넌트 접두사 예: `settings-`, `report-`, `usage-`)을 따른다.

---

## 1. 색상 토큰 (`:root` 변수)

| 변수 | 값 | 용도 |
|---|---|---|
| `--bg` | `#09111c` | 앱 최하단 배경 |
| `--panel` | `#0d1825` | 기본 패널/카드 배경 |
| `--panel-soft` | `#111f2f` | 살짝 밝은 패널(헤더 줄, 보조 카드) |
| `--panel-strong` | `#0a1420` | 입력 필드 배경 등 더 어두운 면 |
| `--border` | `rgba(149,170,194,0.16)` | 기본 구분선/테두리 |
| `--border-strong` | `rgba(149,170,194,0.28)` | 입력/보조 버튼 테두리 |
| `--text` | `#e9edf4` | 기본 본문 글자 |
| `--muted` | `#8493a5` | 보조 설명, 라벨, 캡션 |
| `--mint` | `#54d69b` | 주요 강조/성공/1차 CTA |
| `--mint-soft` | `rgba(84,214,155,0.14)` | mint 배지/필 배경 |
| `--amber` | `#f4b73f` | 경고 상태 |
| `--amber-soft` | `rgba(244,183,63,0.14)` | 경고 배지 배경 |
| `--coral` | `#f36d6d` | 실패/위험/반려/뱃지 카운트 |
| `--blue` | `#4e8fff` | 정보성 강조 (standard 티어 등) |

> 규칙: **성공·주요 액션 = mint / 경고 = amber / 실패·반려 = coral / 정보 = blue.**

---

## 2. 타이포그래피

- 폰트: `"Inter", "Noto Sans KR", sans-serif` (`:root`에서 상속, 개별 지정 불필요).
- 크기 스케일(px): `8`(마이크로 캡션) · `9`(배지/보조 버튼) · `10`(라벨·테이블) · `11`(본문·섹션 제목) · `12~14`(강조 수치) · `15`(뷰 제목 `h1`).
- 굵기: 본문 400, 라벨/제목 500~600, CTA·배지 700.
- 뷰 제목은 `letter-spacing: -0.02em`(`.view-heading h1` 참고).

---

## 3. 뷰 레이아웃 골격

새 화면(탭)을 만들 때 항상 이 구조로 시작한다.

```tsx
<section className="view-panel">
  <header className="view-heading">
    <h1>제목</h1>
    <span>보조 설명 · 메타</span>
  </header>
  {/* 내용: settings-section / 카드 / 테이블 등 */}
</section>
```

- `.view-heading`: 하단 `--border` 구분선 + `h1`(15px)와 `span`(10px, muted)이 baseline 정렬.
- 빈 상태는 `.view-panel.decision-empty` + 가운데 lucide 아이콘(size 34, strokeWidth 1.4) + `h1` + `p`.
- 섹션 구획은 `.settings-section`(하단 margin 18px, 제목은 `h2` 11px/600, 아이콘 동반 시 flex+gap 6px).

---

## 4. 버튼 (가장 자주 틀리는 부분)

**클래스 없는 `<button>` 금지.** 용도별로 아래에서 고른다.

| 상황 | 클래스 | 모양 |
|---|---|---|
| 1차 CTA (저장/실행 등) | `.settings-footer` 안의 `button` | 민트 배경, 글자 `#052317`, 700, 높이 34, radius 7, 아이콘+텍스트 gap 7 |
| 보조/취소/내보내기 | `button.ghost` (footer 안) 또는 `.panel-btn` | 다크(`#142338`) 배경, 글자 `#c9d2dc`, `--border-strong` 테두리 |
| 카드/패널 내 소형 액션 (복사·MD 저장 등) | `.panel-btn` | 높이 25, padding 0 10, 8px/600, hover 시 mint |
| 승인/반려 | `.decision-actions .approve` / `.reject` | approve=민트, reject=coral 톤 |
| 명령 전송 | `.command-form button` | 블루(`#3576dd`), 흰 글자, 700 |
| 아이콘 전용(알림 등) | `.icon-button` | 36×36 정사각, `--border`, 우상단 뱃지는 `i` |
| 3D/2D 토글 등 툴바 | `.office-toolbar button` | 26×26, 투명→hover 반투명 |
| 모달 하단 | `.onboarding-actions button` (+`.ghost`) | 민트 CTA / ghost 보조 |

아이콘 크기 관례: 1차 CTA·footer 버튼 `14`, 패널 소형 버튼 `12`, 배지/리스트 아이콘 `13~16`.

예시 — 1차 저장 버튼:

```tsx
<div className="settings-footer">
  <button type="button" disabled={saving} onClick={() => void handleSave()}>
    <Save size={14} /> {saving ? "저장 중…" : "저장"}
  </button>
  {savedAt ? <small>{savedAt} 저장됨</small> : null}
</div>
```

예시 — 패널 내 보조 버튼:

```tsx
<button className="panel-btn" type="button" onClick={() => void handleCopy()}>
  <Copy size={12} /> 복사
</button>
```

---

## 5. 배지 / 필 / 상태 표시

- **티어 배지**: `.tier-badge.tier-{local|economy|standard|premium}` (회색/민트/블루/보라).
- **검토·상태 필**: `.verdict-strip span.ok`(민트) / `.warn`(amber). 성공/절약률 강조에 재사용.
- **레일 상태 필**: `.rail-status-pill.warn`(예산 경고 등, amber-soft 라운드 필).
- **실행 상태 텍스트**: `.run-status.{running|completed|failed|cancelled}`.
- 새 상태 표시가 필요하면 **위 패턴을 재사용**하고, 색은 3장 규칙(성공 mint / 경고 amber / 실패 coral)에 맞춘다. 새 배지 박스를 임의로 만들지 마라.

---

## 6. 입력 / 폼

**클래스 없는 `<input>`·`<label>` 금지.** 용도별로 아래에서 고른다(안 그러면 브라우저 기본 스타일이 나와 레이아웃이 깨진다).

| 상황 | 클래스 | 형태 |
|---|---|---|
| 라벨(위) + 전체폭 입력(아래) 단일 필드 | `.settings-field` | 라이선스 키·단일 텍스트 입력. grid gap 5, max-width 420, 라벨 muted 10px |
| 라벨 + 값너비 입력 한 줄 | `.settings-inline` | 숫자 한도·환율 등. grid `auto / 90px`(행 나열 시 `.settings-fields-row`로 감쌈) |
| 표 안 입력/select | `.settings-table input` / `select` | 티어 표 등 |
| 2열 키 입력 | `.settings-keys` > `label` | API 키(OpenAI/Anthropic) 나란히 |
| 체크박스 + 설명 | `.settings-check` | flex, gap 8, 체크박스 15×15 `accent-color: var(--mint)`. **체크박스를 `.settings-inline`에 넣지 마라 — 입력이 늘어나 깨진다** |

- 공유 입력 스타일: 높이 28, `--border-strong` 테두리, `--panel-strong` 배경, radius 5, 10px (`.settings-field/.settings-keys/.settings-table/.settings-inline`의 `input:not([type=checkbox])`).
- 섹션 안내문은 `.settings-note`(muted 9px). 인라인 코드 강조는 `<code>`.
- 폼 저장 액션은 섹션 안이 아니라 **`.settings-footer`** 로 내린다(구분선 위 CTA + 저장 시각 `small`). 섹션 내부 소형 저장은 `.settings-footer.settings-footer-inline`.

예시 — 단일 필드 + 체크박스:

```tsx
<label className="settings-field">
  앱 라이선스 키
  <input value={key} onChange={...} placeholder="OAIV1...." />
</label>

<label className="settings-check">
  <input type="checkbox" checked={on} onChange={...} />
  업무 완료/실패 사운드 재생
</label>
```

### 연결 상태 표시

서비스/연동 상태는 새 배지 박스를 만들지 말고 **`.status-dot` + 텍스트**로 표현한다(색 규칙 준수).

| 상태 | 도트 클래스 | 색 | 예 |
|---|---|---|---|
| 정상/연결됨 | `.status-dot.running` | mint | "API 키 저장됨" |
| 주의/필요 | `.status-dot.paused` | amber | "API 키 필요" |
| 정보/대기 | `.status-dot.waiting` | gray | "CLI 로그인 필요" |

목록형 연결 상태는 `.conn-list` > `.conn-row`(이름 `.conn-name` · 사용 티어 `.conn-tiers` · 상태 `.conn-state`) 패턴을 재사용한다(`ConnectionStatusSection.tsx` 참고).

---

## 7. 카드 / 테이블 / 리스트

- 산출물·결과 카드: `.report-deliverable`(테두리+radius 8, 헤더 `.report-deliverable-header`는 `--panel-soft`), 본문은 `<pre>`(10px, `white-space: pre-wrap`).
- 산출물 내 실행 액션: `.action-panel`(헤더 `.action-panel-header`) > `.action-list` > `.action-row`(아이콘 · 모노 경로/명령 `.action-target` · `.panel-btn` · 결과 `.action-note.ok|.warn`). `DeliverableActions.tsx` 참고 — 새 실행형 목록 UI는 이 패턴 재사용.
- 이력 테이블: `.runs-table` / 설정 테이블: `.settings-table`. th는 muted 500, 행 구분선 `rgba(149,170,194,0.09)`, hover `rgba(255,255,255,0.03)`.
- 우측 레일 패널: `.activity-rail > div`(min-height 168, padding 12, radius 10) + `.rail-heading`(제목 flex space-between).

---

## 8. 간격 · 반경 스케일

- radius: 입력/소형 버튼 `5`, 카드 `7~8`, 패널 `10`, 배지 `4`, 필 `20`.
- 패널 padding: 카드 `12`, 큰 뷰 섹션 사이 margin `18`.
- 아이콘-텍스트 gap: 버튼 `6~7`, 리스트 `5`.

---

## 9. 새 UI 만들 때 체크리스트

1. `.view-panel` + `.view-heading`로 감쌌는가?
2. 색을 리터럴 대신 CSS 변수로 썼는가?
3. 모든 버튼에 위 표의 클래스를 붙였는가? (특히 카드 안은 `.panel-btn`)
4. 상태 색이 mint/amber/coral 규칙과 맞는가?
5. 아이콘은 lucide이고 크기 관례를 지켰는가?
6. 저장/CTA는 섹션 안이 아니라 footer에 있는가?
7. 변경 후 `npm run build`로 타입·번들 확인했는가?
