import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { signLicensePayload } from "../shared/license-crypto";

const args = process.argv.slice(2);
let employees: string[] | undefined;
const positional: string[] = [];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--employees") {
    const next = args[index + 1];
    if (!next) {
      console.error("--employees 뒤에 SKU 목록이 필요합니다.");
      process.exit(1);
    }
    employees = next.split(",").map((item) => item.trim()).filter(Boolean);
    index += 1;
    continue;
  }
  positional.push(arg);
}

const [email, expiresAt, edition = "standard"] = positional;

if (!email || !expiresAt) {
  console.error(
    "사용법: npx tsx scripts/issue-license.ts <email> <YYYY-MM-DD> [standard|pro] [--employees sku1,sku2]",
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
  ...(employees && employees.length > 0 ? { employees } : {}),
};

console.log(signLicensePayload(payload, privateKey));
