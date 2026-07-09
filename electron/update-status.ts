export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

export type UpdateStatus = {
  phase: UpdatePhase;
  currentVersion: string;
  availableVersion?: string;
  percent?: number;
  message?: string;
};

export function createIdleUpdateStatus(currentVersion: string): UpdateStatus {
  return { phase: "idle", currentVersion };
}

export function shouldShowUpdateBanner(status: UpdateStatus) {
  return (
    status.phase === "downloaded" ||
    status.phase === "downloading" ||
    status.phase === "available"
  );
}

export function formatUpdateBannerText(status: UpdateStatus) {
  if (status.phase === "downloaded") {
    const version = status.availableVersion ?? "새 버전";
    return `OfficeAI ${version} 다운로드가 완료되었습니다. 재시작하면 업데이트가 적용됩니다.`;
  }
  if (status.phase === "downloading") {
    const percent = Math.round(status.percent ?? 0);
    const version = status.availableVersion ?? "새 버전";
    return `OfficeAI ${version} 업데이트 다운로드 중… ${percent}%`;
  }
  if (status.phase === "available") {
    const version = status.availableVersion ?? "새 버전";
    return `OfficeAI ${version} 업데이트를 받는 중입니다.`;
  }
  return "";
}
