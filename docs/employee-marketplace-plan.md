# AI 직원 마켓플레이스 — 기획서 & 구현 가이드 (G16)

> **목적:** 사용자는 OfficeAI 본체(라이선스)를 쓰고, **직무별 AI "직원"을 개별 구매**해서 팀에 추가한다.
> 이 문서는 *기획 + 구현 가이드*만 담는다. 실제 코드는 별도로 구현한다.
> 구현 시 **반드시 `docs/dev-guide.md`의 절대 규칙**(코어 재작성 금지, 타입 단일 출처, IPC 3곳 동시 수정, 검증 3종)을 지킨다.

---

## 1. 비즈니스 모델

| 계층 | 판매 형태 | 설명 |
|------|-----------|------|
| 본체 라이선스 | 1회 구매 or 구독 | 앱 자체 사용권. 이미 G13에 오프라인 서명 라이선스 구현됨 |
| 기본 직원 (무료) | 본체에 포함 | 맥락냥·기획냥·보고냥 — 없으면 앱이 아무것도 못 하므로 기본 제공 |
| 유료 직원 (Add-on) | 직원 단위 구매 | 코드냥·리서치냥·PM냥·운영냥·검증냥 등 |
| 프리미엄 변형 | 상위 SKU | "코드냥 Pro" = 상위 티어 강제 + 강화 프롬프트 + 전용 크리틱 |

핵심 아이디어: **직원 = 엔타이틀먼트(구매 권리) SKU**. 구매하면 서명된 토큰으로 잠금 해제된다. 결제는 오프라인 키 발급(기본) 또는 온라인 결제(옵션)로 처리한다.

---

## 2. 핵심 개념

- **EmployeeSKU**: 판매 단위. 하나의 `WorkerRole`(또는 크리틱 페르소나)에 이름·설명·가격·강화옵션을 묶은 카탈로그 항목.
- **Entitlement(권리)**: 사용자가 실제로 보유한 SKU 목록. 서명된 라이선스 페이로드 안에 들어간다.
- **Roster(팀 명단)**: 현재 활성화된 직원. 보유한 직원 중 사용자가 켠 것.
- **Gating(게이팅)**: 미보유 직무가 필요한 업무가 생기면 → 구매 유도 + 기본 직원으로 폴백.

기존 `WorkerRole`(`core/src/contracts.ts`)을 그대로 SKU 키로 재사용한다. **새 역할 타입을 core에 추가하지 않는다**(dispatcher 재테스트 유발). 신규 직무가 필요하면 프롬프트 팩/변형 SKU로 표현한다.

---

## 3. 데이터 모델 (제안)

신규 타입은 `shared/` 에 두어 renderer/electron/core 어디서든 `import type` 가능하게 한다.

```ts
// shared/employees.ts (신규)
import type { ModelTier, WorkerRole } from "../core/src/contracts";

export type EmployeeSkuId = string; // 예: "developer", "developer-pro", "pm"

export type EmployeeSku = {
  id: EmployeeSkuId;
  role: WorkerRole;          // 기존 역할에 매핑
  displayName: string;       // "코드냥"
  variant?: "base" | "pro";  // pro = 강화판
  tierFloor?: ModelTier;     // 이 직원이 최소 보장하는 티어 (pro 전용)
  priceKrw: number;
  includedInBase: boolean;   // 무료 기본 직원 여부
  summary: string;           // 마켓 카드 설명
  promptPackId?: string;     // 강화 프롬프트 팩 참조 (선택)
};

export type Entitlement = {
  ownedSkus: EmployeeSkuId[];   // 서명 라이선스에서 파생
  activeSkus: EmployeeSkuId[];  // 사용자가 켠 직원 (userData에 저장)
};
```

**카탈로그**(`shared/employee-catalog.ts`)는 정적 배열로 시작한다. 서버 없이도 동작해야 한다.

```ts
export const EMPLOYEE_CATALOG: EmployeeSku[] = [
  { id: "context-curator", role: "context-curator", displayName: "맥락냥", priceKrw: 0, includedInBase: true, summary: "..." },
  { id: "planner",        role: "planner",  displayName: "기획냥", priceKrw: 0,     includedInBase: true,  summary: "..." },
  { id: "reporter",       role: "reporter", displayName: "보고냥", priceKrw: 0,     includedInBase: true,  summary: "..." },
  { id: "developer",      role: "developer",displayName: "코드냥", priceKrw: 29000, includedInBase: false, summary: "..." },
  { id: "developer-pro",  role: "developer",displayName: "코드냥 Pro", variant: "pro", tierFloor: "premium", priceKrw: 79000, includedInBase: false, summary: "..." },
  { id: "researcher",     role: "researcher",displayName:"리서치냥",priceKrw: 19000, includedInBase: false, summary: "..." },
  { id: "pm",             role: "pm",       displayName: "PM냥",   priceKrw: 19000, includedInBase: false, summary: "..." },
  { id: "operator",       role: "operator", displayName: "운영냥", priceKrw: 24000, includedInBase: false, summary: "..." },
  { id: "verifier",       role: "verifier", displayName: "검증냥", priceKrw: 24000, includedInBase: false, summary: "..." },
];
```

---

## 4. 라이선스 페이로드 확장 (G13 재사용)

`shared/license-core.ts`의 `LicensePayload`에 **직원 권리**를 추가한다. 서명 방식(Ed25519)은 그대로.

```ts
export type LicensePayload = {
  v: 1;
  email?: string;
  expiresAt?: string;
  edition?: "standard" | "pro";
  employees?: EmployeeSkuId[];  // 신규: 이 라이선스로 잠금 해제되는 직원
};
```

- **본체 키**: `employees` 없거나 기본 세트만.
- **직원 추가 키**: 별도 발급한 서명 키 하나에 `employees: ["developer","pm"]` 처럼 담아 배포. 앱은 **여러 키를 누적 보관**(`license.json`의 배열)하고, 모든 유효 키의 `employees`를 합집합해 `ownedSkus`를 만든다.
- 발급 스크립트: `scripts/issue-license.ts`를 확장해 `--employees developer,pm` 인자를 받게 한다.

> 오프라인 서명 방식을 유지하면 서버 없이도 판매/발급이 가능하다(현재 구조의 장점).

---

## 5. 아키텍처 매핑 (어디에 얹는가)

| 관심사 | 위치 | 변경 성격 |
|--------|------|-----------|
| SKU 타입/카탈로그 | `shared/employees.ts`, `shared/employee-catalog.ts` | 신규(순수 데이터, 테스트 안전) |
| 권리 계산 | `shared/entitlement.ts` (여러 라이선스 → ownedSkus 합집합) | 신규 |
| 저장/서명검증 | `electron/license-store.ts`, `shared/license-crypto.ts` | 확장(payload 필드 추가) |
| IPC | `electron/ipc-contract.ts` + main + preload | 채널 추가 |
| UI | `src/components/MarketplaceView.tsx`, `TeamRosterSection.tsx` | 신규 뷰 |
| 게이팅(선택) | orchestrator **밖** 프리플라이트 or UI | 코어 미변경 원칙 |

---

## 6. 게이팅 전략 (코어 규칙 준수)

**원칙: `core/src/orchestration/dispatcher.ts`·`orchestrator.ts`를 수정하지 않는다** (테스트 재검증 유발). 대신 두 지점에서 게이팅:

### (A) 프리플라이트 안내 — 권장 기본값
- `run:planned` 이벤트에는 `plan.units[].role`이 들어 있다(이미 존재).
- Electron main 또는 renderer가 이 이벤트를 받아, plan에 **미보유 직무**가 있으면:
  - 실행은 **막지 않고** 진행(기본 프롬프트로 동작),
  - UI에 배지: *"이 업무는 코드냥(구매 필요)에 최적화됩니다 → 마켓플레이스"*.
- 장점: 코어 무변경, 체험 유도. `run:planned`는 이미 렌더러가 구독 중.

### (B) 강화(Pro) 적용 — 선택
- 보유한 `pro` 직원의 `tierFloor`·`promptPackId`를 **엔진 부팅 시 config로 주입**.
- `createEngine`에 **선택적** `rolePromptOverrides?: Partial<Record<WorkerRole,string>>` / `roleTierFloor?` 옵션을 추가(값이 없으면 기존과 100% 동일 → 기존 테스트 통과 유지).
- main의 `bootEngine()`이 활성 직원에서 오버라이드를 만들어 넘긴다.

> 하드 블로킹(미구매 시 아예 실행 거부)은 권장하지 않음: 크리틱/기획 등은 조합으로 돌아가므로 부분 차단이 UX를 해친다. "체험 → 강화 구매" 모델이 전환율에 유리.

---

## 7. 구매·활성화 플로우

### 오프라인(기본, 서버 불필요)
```
사용자 결제(외부: 계좌이체/스토어/PG)
  → 판매자가 scripts/issue-license.ts --employees ... 로 서명 키 발급
  → 사용자에게 키 전달
  → 설정/마켓플레이스에서 키 입력 → activateLicense → ownedSkus 갱신
  → onLicenseStatusChanged 로 UI 즉시 반영
```

### 온라인(옵션, 나중에)
- 결제: 저장소에 **PayKit MCP**가 연결되어 있음 → 결제 세션 생성/검증에 활용 가능.
- 흐름: 앱 내 "구매" 클릭 → 결제 페이지 → 웹훅/폴링으로 결제 확인 → 서버가 서명 키 발급 → 앱이 키 수신·활성화.
- 서버 최소화: 결제 확인 후 **동일한 Ed25519 서명 키**만 돌려주면 되므로 오프라인 검증 로직을 그대로 재사용.

---

## 8. IPC 계약 추가 (electron/ipc-contract.ts)

```ts
// IPC 상수에 추가
getEmployeeCatalog: "employees:catalog",   // 정적 카탈로그 + 가격
getEntitlement: "employees:entitlement",   // ownedSkus / activeSkus
setActiveEmployees: "employees:set-active", // 로스터 토글 저장 → bootEngine 재적용
purchaseEmployee: "employees:purchase",     // (온라인 옵션) 결제 세션 시작

// push
entitlementChanged: "employees:changed",
```

- 타입도 이 파일에 선언(단일 출처). renderer는 `src/state/bridge-types.ts`에서 재노출.
- `setActiveEmployees` 처리 시 `bootEngine()`을 다시 불러 (B) 강화 오버라이드를 반영.

---

## 9. UI 설계

### 마켓플레이스 뷰 (`MarketplaceView.tsx`, 네비 "직원 마켓" 신규 or 설정 하위 탭)
- 카탈로그 카드 그리드: 직원 아바타(3D 고양이 썸네일 재활용 가능), 이름, 설명, 가격(₩), 상태 배지(보유/미보유/기본제공).
- 미보유: "구매" 버튼 → 오프라인이면 "키 입력" 모달, 온라인이면 결제.
- 보유: "팀에 배치/해제" 토글.
- 디자인은 `docs/design-guide.md` 준수(기존 `settings-section`, `panel-btn`, `tier-badge` 재사용, 새 색/CSS-in-JS 금지).

### 내 팀 관리 (`TeamRosterSection.tsx`, 설정 내)
- 활성 직원 목록 + on/off. 저장 → `setActiveEmployees`.

### 기존 화면 연동
- **에이전트/프로세스 뷰**: 미보유 직무 유닛에 잠금 배지 + 마켓 링크.
- **대시보드 3D**: 보유 직원만 정식 캐릭터, 미보유는 반투명 "잠김" 표시(선택).

---

## 10. 단계별 구현 카드 (완료 기준 + 검증 3종 필수)

| 카드 | 내용 | 완료 기준 |
|------|------|-----------|
| **M1** | `shared/employees.ts` + `employee-catalog.ts` + `entitlement.ts`(합집합/보유판정) + 단위 테스트 | `core:test`에 entitlement 테스트 통과 |
| **M2** | 라이선스 payload에 `employees` 추가, 다중 키 누적 저장, 발급 스크립트 `--employees` | 서명 키로 ownedSkus가 나오는 테스트 통과 |
| **M3** | IPC 채널(catalog/entitlement/set-active) + main + preload + bridge-types | 앱에서 카탈로그·권리 조회됨 |
| **M4** | `MarketplaceView` + `TeamRosterSection` UI, 키 입력 활성화 | 키 입력 → 보유 직원 반영, 재시작 후 유지 |
| **M5** | 프리플라이트 게이팅: `run:planned`에서 미보유 직무 배지·마켓 유도 | 미보유 직무 업무 시 안내 노출 |
| **M6** (선택) | (B) 강화 오버라이드: `createEngine` 선택 옵션 + boot 적용 | 옵션 없을 때 기존 테스트 전부 통과(회귀 없음) |
| **M7** (선택) | 온라인 결제(PayKit MCP) + 서명 키 자동 발급/수신 | 결제 성공 시 직원 자동 잠금 해제 |

---

## 11. 반드시 지킬 것 (dev-guide 규칙 요약)

1. `core/src/orchestration|providers|budget|telemetry` **수정 금지**(M6 옵션은 *추가만*, 기본값 없으면 기존과 동일해야 함).
2. 타입 단일 출처: 엔진 타입은 `core/*`, IPC는 `ipc-contract.ts`, 공유 도메인은 `shared/*`. renderer는 `import type`만.
3. API 키·개인정보 renderer 노출 금지. 라이선스 개인키(`config/license-private.pem`)는 판매자 PC 전용, git 제외.
4. localStorage 키 `officeai.` 접두사, userData 파일로 영속.
5. 새 npm 패키지 추가 전 사용자 승인. 그래프/CSS-in-JS 금지.
6. 변경 후 `npm run core:test` + `npm run lint` + `npm run build` (+ `app:build`) 전부 통과.
7. 한글 응답, 주석은 "왜"만, `any` 금지, PowerShell은 `;` 연결.

---

## 12. 오픈 질문 (구현 전 결정 필요)

- 판매 단가/번들 구성(개별 vs 팀 패키지)?
- 기본 무료 직원 세트 범위(맥락·기획·보고 3종이 적절한가)?
- 구독형(만료 `expiresAt`) vs 영구? 직원별로 다르게?
- 온라인 결제 도입 시점(M7) 및 PG(국내 KCP 등) — PayKit MCP로 프로토타입 후 결정.
