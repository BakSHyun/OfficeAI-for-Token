import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync("build/icon.png")) {
  console.error("build/icon.png 가 없습니다.");
  process.exit(1);
}

// PowerShell 리다이렉트는 ICO 바이너리를 깨뜨리므로 cmd로 생성한다.
execSync("cmd /c npx --yes png-to-ico build/icon.png > build/icon.ico", {
  stdio: "inherit",
});

if (process.platform === "darwin") {
  execSync(
    "npx --yes png2icons build/icon.png build/icon -icns -i",
    { stdio: "inherit" },
  );
}
