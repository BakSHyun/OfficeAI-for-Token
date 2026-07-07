# OfficeAI 배포 가이드 (G14)

## 코드 사이닝

Windows와 macOS 모두 **코드 사이닝 인증서는 판매자(사용자)가 직접 구매**해야 합니다. OfficeAI 저장소에는 인증서를 포함하지 않습니다.

### Windows (NSIS 인스톨러)

1. **EV 코드 서명 인증서** 권장 (SmartScreen 경고 완화)
2. 환경 변수 설정 후 패키징:
   ```powershell
   $env:CSC_LINK = "C:\path\to\certificate.pfx"
   $env:CSC_KEY_PASSWORD = "인증서 비밀번호"
   npm run app:package:win
   ```
3. 인증서 없이 빌드하면 설치·실행 시 SmartScreen 경고가 뜹니다. G3 자동 업데이트 전에 사이닝을 권장합니다.

### macOS (DMG)

1. Apple Developer Program 가입
2. **Developer ID Application** 인증서 + **notarization** 필요
3. 환경 변수 예시:
   ```bash
   export CSC_LINK=/path/to/cert.p12
   export CSC_KEY_PASSWORD=...
   export APPLE_ID=...
   export APPLE_APP_SPECIFIC_PASSWORD=...
   export APPLE_TEAM_ID=...
   npm run app:package:mac
   ```
4. notarization 없이 배포하면 Gatekeeper에서 차단될 수 있습니다.

`electron-builder.yml`의 `publish`는 G3(자동 업데이트) 전까지 `null`로 둡니다.

---

## 크래시 리포팅 (Sentry, opt-in)

- SDK: `@sentry/electron` (main 프로세스)
- **기본 꺼짐** — 설정 → 개인정보 → "익명 크래시 리포트 보내기"
- DSN은 빌드 시 환경 변수로만 주입 (renderer에 노출하지 않음):
  ```powershell
  $env:OFFICEAI_SENTRY_DSN = "https://...@sentry.io/..."
  npm run app:package:win
  ```
- DSN이 없으면 opt-in을 켜도 전송되지 않습니다.
- Sentry 프로젝트는 별도 생성이 필요합니다.

---

## 릴리스 체크리스트

1. `npm run core:test` / `npm run lint` / `npm run build` 통과
2. `npm run app:build` 통과
3. 코드 사이닝 적용 후 `npm run app:package:win|mac`
4. 인스톨러로 설치 → mock 티어로 명령 1건 완료 스모크 테스트
5. (선택) Sentry DSN 설정 빌드로 크래시 1건 수신 확인
