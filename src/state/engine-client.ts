import type {
  ApprovalRequest,
  OfficeAIBridge,
  RunEvent,
} from "./bridge-types";
import { useEngineStore } from "./engine-store";
import { createDemoDriver } from "./demo-driver";

export type EngineClient = {
  mode: "electron" | "demo";
  submitCommand(command: string): Promise<void>;
  resolveApproval(
    requestId: string,
    approved: boolean,
    note?: string,
  ): Promise<void>;
  cancelRun(runId: string): Promise<void>;
  /** 가공 전 RunEvent 구독 (3D 씬 등 store를 거치지 않는 소비자용) */
  subscribeRaw(listener: (event: RunEvent) => void): () => void;
  bridge?: OfficeAIBridge;
};

let client: EngineClient | null = null;
const rawListeners = new Set<(event: RunEvent) => void>();

function dispatch(event: RunEvent) {
  useEngineStore.getState().applyEvent(event);
  for (const listener of rawListeners) {
    try {
      listener(event);
    } catch {
      // 구독자 오류 격리
    }
  }
}

function subscribeRaw(listener: (event: RunEvent) => void) {
  rawListeners.add(listener);
  return () => rawListeners.delete(listener);
}

/**
 * Electron 안이면 preload 브리지에, 브라우저(npm run dev)면 데모 드라이버에 연결.
 * 어느 쪽이든 이벤트는 동일하게 engine-store로 흘러 UI 코드는 차이를 모른다.
 */
export function connectEngine(): EngineClient {
  if (client) return client;
  const store = useEngineStore.getState();

  if (window.officeai) {
    const bridge = window.officeai;
    bridge.onEvent(dispatch);
    void bridge
      .pendingApprovals()
      .then((approvals: ApprovalRequest[]) => store.setApprovals(approvals));
    store.setConnected(true);

    client = {
      mode: "electron",
      bridge,
      subscribeRaw,
      async submitCommand(command) {
        await bridge.submitCommand(command);
      },
      async resolveApproval(requestId, approved, note) {
        await bridge.resolveApproval(requestId, approved, note);
        useEngineStore.getState().removeApproval(requestId);
      },
      async cancelRun(runId) {
        await bridge.cancelRun(runId);
      },
    };
    return client;
  }

  const demo = createDemoDriver(dispatch);
  store.setConnected(true);
  client = {
    mode: "demo",
    subscribeRaw,
    async submitCommand(command) {
      demo.run(command);
    },
    async resolveApproval(requestId, approved) {
      demo.resolveApproval(requestId, approved);
    },
    async cancelRun() {},
  };
  return client;
}
