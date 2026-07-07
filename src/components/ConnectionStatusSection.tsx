import { useCallback, useEffect, useState } from "react";
import { PlugZap, RefreshCw } from "lucide-react";
import type { ProviderConfig, ProviderProbeResult } from "../state/bridge-types";

type ConnectionStatusSectionProps = {
  providers: ProviderConfig;
  apiKeyPresence: Record<string, boolean>;
};

const tierLabel: Record<string, string> = {
  local: "local",
  economy: "economy",
  standard: "standard",
  premium: "premium",
};

const providerDisplay: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  lmstudio: "LM Studio",
  "cursor-agent-cli": "Cursor Agent CLI",
  "codex-cli": "Codex CLI",
  mock: "테스트(mock)",
};

function staticHint(
  provider: string,
  apiKeyPresence: Record<string, boolean>,
  baseUrls?: Record<string, string>,
): string {
  switch (provider) {
    case "openai":
    case "anthropic":
      return apiKeyPresence[provider] ? "API 키 저장됨" : "API 키 필요";
    case "lmstudio":
      return baseUrls?.lmstudio ?? "http://localhost:1234/v1";
    case "cursor-agent-cli":
      return "터미널에서 agent login";
    case "codex-cli":
      return "터미널에서 codex login";
    case "mock":
      return "키 없이 동작";
    default:
      return "설정됨";
  }
}

export function ConnectionStatusSection({
  providers,
  apiKeyPresence,
}: ConnectionStatusSectionProps) {
  const bridge = window.officeai;
  const [probes, setProbes] = useState<ProviderProbeResult[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const tiers = Object.entries(providers.tiers);
  const usedProviders = Array.from(
    new Set(tiers.map(([, binding]) => binding.provider)),
  );

  const refresh = useCallback(async () => {
    if (!bridge) return;
    setChecking(true);
    try {
      const result = await bridge.probeProviders();
      setProbes(result);
      setCheckedAt(new Date().toLocaleTimeString("ko-KR"));
    } finally {
      setChecking(false);
    }
  }, [bridge]);

  useEffect(() => {
    if (!bridge) return;
    void refresh();
  }, [bridge, refresh, providers, apiKeyPresence]);

  const probeMap = new Map(probes?.map((item) => [item.provider, item]) ?? []);

  return (
    <div className="settings-section conn-status-section">
      <div className="conn-status-heading">
        <h2>
          <PlugZap size={13} /> 연결 상태
        </h2>
        {bridge ? (
          <button
            className="panel-btn"
            disabled={checking}
            onClick={() => void refresh()}
            type="button"
          >
            <RefreshCw size={12} className={checking ? "spin" : undefined} />
            {checking ? "확인 중…" : "새로고침"}
          </button>
        ) : null}
      </div>
      <p className="settings-note">
        현재 티어에 배정된 AI 서비스의 <strong>실제 연결</strong>을 확인합니다.
        LM Studio는 로컬 서버 실행 여부, Cursor/Codex는 CLI 설치·로그인 여부를
        검사합니다. API 키(OpenAI/Anthropic)는 저장 여부와 서버 응답을 함께
        봅니다.
      </p>
      <div className="conn-list">
        {usedProviders.map((provider) => {
          const usingTiers = tiers
            .filter(([, binding]) => binding.provider === provider)
            .map(([tier]) => tierLabel[tier] ?? tier);
          const probe = probeMap.get(provider);
          const live = probe
            ? probe.ok
              ? "ok"
              : "warn"
            : bridge
              ? "pending"
              : "static";
          const detail =
            probe?.detail ??
            staticHint(provider, apiKeyPresence, providers.baseUrls);
          const dotClass =
            live === "ok"
              ? "status-dot running"
              : live === "warn"
                ? "status-dot paused"
                : "status-dot waiting";

          return (
            <div className="conn-row" key={provider}>
              <span className="conn-name">
                {providerDisplay[provider] ?? provider}
              </span>
              <span className="conn-tiers">{usingTiers.join(" · ")} 티어</span>
              <span className="conn-state" title={detail}>
                <span className={dotClass} />
                {detail}
              </span>
            </div>
          );
        })}
      </div>
      {checkedAt ? (
        <p className="settings-note conn-checked-at">
          마지막 확인: {checkedAt}
          {!bridge ? " (데모 — Electron 앱에서 실측)" : null}
        </p>
      ) : null}
    </div>
  );
}
