import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { signLicensePayload } from "../shared/license-crypto";

const [, , email, expiresAt, edition = "standard"] = process.argv;

if (!email || !expiresAt) {
  console.error(
    "사용법: npx tsx scripts/issue-license.ts <email> <YYYY-MM-DD> [standard|pro]",
  );
  process.exit(1);
}

const privatePath = join(process.cwd(), "config", "license-private.pem");
if (!existsSync(privatePath)) {
  console.error(
    "config/license-private.pem 이 없습니다. config/license-private.pem.example 을 참고하세요.",
  );
  process.exit(1);
}

const privateKey = readFileSync(privatePath, "utf8");
const payload = {
  v: 1 as const,
  email,
  expiresAt,
  edition: edition === "pro" ? ("pro" as const) : ("standard" as const),
};

console.log(signLicensePayload(payload, privateKey));
