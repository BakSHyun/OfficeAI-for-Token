import { join } from "node:path";
import type {
  RepositorySnapshot,
  VerificationCommand,
  VerificationPlan,
} from "./contracts";

function command(
  repository: RepositorySnapshot,
  id: string,
  label: string,
  executable: string,
  args: string[],
  timeoutMs: number,
  reason: string,
): VerificationCommand {
  return {
    id: `${repository.id}:${id}`,
    repositoryId: repository.id,
    label,
    command: executable,
    args,
    cwd: repository.root,
    timeoutMs,
    reason,
  };
}

function laravelVerification(
  repository: RepositorySnapshot,
): VerificationPlan {
  const commands: VerificationCommand[] = [];
  const manualChecks: string[] = [];
  const phpFiles = repository.changedFiles.filter((file) =>
    file.endsWith(".php"),
  );
  const tests = phpFiles.filter((file) => /^tests[\\/]/.test(file));

  for (const file of phpFiles) {
    commands.push(
      command(
        repository,
        `php-lint:${file}`,
        `PHP syntax: ${file}`,
        "php",
        ["-l", join(repository.root, file)],
        20_000,
        "변경된 PHP 파일의 구문 검사",
      ),
    );
  }
  for (const file of tests) {
    commands.push(
      command(
        repository,
        `test:${file}`,
        `Targeted test: ${file}`,
        "php",
        ["artisan", "test", file],
        180_000,
        "변경된 테스트 파일만 우선 실행",
      ),
    );
  }

  const behaviorChanged = repository.changedFiles.some((file) =>
    /^(app|routes|database)[\\/]/.test(file),
  );
  if (behaviorChanged && tests.length === 0) {
    manualChecks.push(
      `${repository.id}: 동작 코드가 변경됐지만 자동 선택 가능한 테스트 파일이 없습니다. 관련 테스트를 지정해야 합니다.`,
    );
  }

  return { commands, manualChecks };
}

function adminVerification(
  repository: RepositorySnapshot,
): VerificationPlan {
  const codeChanged = repository.changedFiles.some((file) =>
    /\.(ts|tsx|js|jsx|json|css)$/.test(file),
  );
  if (!codeChanged) return { commands: [], manualChecks: [] };

  return {
    commands: [
      command(
        repository,
        "lint",
        "Admin lint",
        "npm",
        ["run", "lint"],
        180_000,
        "AGENTS.md에서 요구한 정적 검사",
      ),
      command(
        repository,
        "build",
        "Admin type/build",
        "npm",
        ["run", "build"],
        240_000,
        "타입과 API 계약 변경 검증",
      ),
    ],
    manualChecks: [],
  };
}

export function planVerification(
  repositories: RepositorySnapshot[],
): VerificationPlan {
  const plans = repositories.map((repository) =>
    repository.stack === "laravel"
      ? laravelVerification(repository)
      : adminVerification(repository),
  );

  return {
    commands: plans.flatMap(({ commands }) => commands),
    manualChecks: plans.flatMap(({ manualChecks }) => manualChecks),
  };
}
