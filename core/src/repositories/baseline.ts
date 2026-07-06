import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  RepositoryBaseline,
  RepositorySnapshot,
  VerificationPlan,
} from "./contracts";
import { runVerification } from "./verification-runner";

function baselinePath(root: string, repository: RepositorySnapshot) {
  return join(
    root,
    "baselines",
    `${repository.id}-${repository.head.slice(0, 12)}.json`,
  );
}

export function planBaseline(
  repository: RepositorySnapshot,
): VerificationPlan {
  if (repository.stack === "laravel") {
    return {
      commands: [
        {
          id: `${repository.id}:baseline:artisan`,
          repositoryId: repository.id,
          label: "Laravel boot baseline",
          command: "php",
          args: ["artisan", "--version"],
          cwd: repository.root,
          timeoutMs: 30_000,
          reason: "환경과 Laravel 부팅 확인",
        },
      ],
      manualChecks: [
        `${repository.id}: 전체 테스트는 변경 범위가 정해진 뒤 관련 테스트부터 실행합니다.`,
      ],
    };
  }

  return {
    commands: [
      {
        id: `${repository.id}:baseline:lint`,
        repositoryId: repository.id,
        label: "Admin lint baseline",
        command: "npm",
        args: ["run", "lint"],
        cwd: repository.root,
        timeoutMs: 180_000,
        reason: "현재 커밋의 기존 lint 상태 기록",
      },
      {
        id: `${repository.id}:baseline:build`,
        repositoryId: repository.id,
        label: "Admin build baseline",
        command: "npm",
        args: ["run", "build"],
        cwd: repository.root,
        timeoutMs: 240_000,
        reason: "현재 커밋의 기존 타입/빌드 상태 기록",
      },
    ],
    manualChecks: [],
  };
}

export async function createBaseline(
  officeAiRoot: string,
  repository: RepositorySnapshot,
): Promise<RepositoryBaseline> {
  const verification = planBaseline(repository);
  const results = await runVerification(verification);
  const baseline: RepositoryBaseline = {
    repositoryId: repository.id,
    head: repository.head,
    createdAt: new Date().toISOString(),
    verification,
    results,
    passed:
      results.length === verification.commands.length &&
      results.every((result) => result.exitCode === 0 && !result.timedOut),
  };
  const path = baselinePath(officeAiRoot, repository);
  await mkdir(join(officeAiRoot, "baselines"), { recursive: true });
  await writeFile(path, JSON.stringify(baseline, null, 2) + "\n", "utf8");
  return baseline;
}

export async function loadBaseline(
  officeAiRoot: string,
  repository: RepositorySnapshot,
): Promise<RepositoryBaseline | null> {
  try {
    return JSON.parse(
      await readFile(baselinePath(officeAiRoot, repository), "utf8"),
    ) as RepositoryBaseline;
  } catch {
    return null;
  }
}
