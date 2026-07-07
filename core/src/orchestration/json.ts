/** LLM 응답에서 JSON을 관대하게 추출한다 (코드펜스, 앞뒤 잡담 허용). */
export function parseJsonLenient<T>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // fall through
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim()) as T;
    } catch {
      // fall through
    }
  }

  const start = trimmed.search(/[[{]/);
  if (start >= 0) {
    const open = trimmed[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < trimmed.length; index += 1) {
      const character = trimmed[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') inString = !inString;
      if (inString) continue;
      if (character === open) depth += 1;
      if (character === close) {
        depth -= 1;
        if (depth === 0) {
          return JSON.parse(trimmed.slice(start, index + 1)) as T;
        }
      }
    }
  }

  throw new Error(`JSON 파싱 실패: ${trimmed.slice(0, 200)}`);
}
