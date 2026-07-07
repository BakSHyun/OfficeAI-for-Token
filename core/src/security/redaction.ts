const patterns: Array<{ name: string; pattern: RegExp }> = [
  {
    name: "private-key",
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gi,
  },
  {
    name: "bearer-token",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/gi,
  },
  {
    name: "openai-style-key",
    pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  },
  {
    name: "aws-access-key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    name: "secret-assignment",
    pattern:
      /\b(password|passwd|secret|token|api[_-]?key|client[_-]?secret)\b["']?\s*[:=]\s*["']?[^"'\s,;]{6,}/gi,
  },
  {
    name: "email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
];

export type RedactionResult = {
  text: string;
  redactionCount: number;
  matchedTypes: string[];
};

export function redactSensitiveText(input: string): RedactionResult {
  let text = input;
  let redactionCount = 0;
  const matchedTypes = new Set<string>();

  for (const { name, pattern } of patterns) {
    text = text.replace(pattern, () => {
      redactionCount += 1;
      matchedTypes.add(name);
      return `[REDACTED:${name}]`;
    });
  }

  return {
    text,
    redactionCount,
    matchedTypes: [...matchedTypes],
  };
}

/** 객체를 JSON으로 직렬화한 뒤 패턴 기반 redaction을 적용한다. */
export function redactSensitiveJson(value: unknown): unknown {
  const { text } = redactSensitiveText(JSON.stringify(value));
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function classifySensitivity(redactionCount: number): SensitivityLabel {
  if (redactionCount > 0) return "restricted";
  return "internal";
}

type SensitivityLabel = "internal" | "restricted";
