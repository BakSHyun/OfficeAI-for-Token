import { sign, verify } from "node:crypto";
import {
  LICENSE_PREFIX,
  buildLicenseStatus,
  normalizeLicenseKeys,
  type LicensePayload,
  type LicenseState,
} from "./license-core";

const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA5PnmTNK7JPmSnQvMHzsR/vYTd0apUAZMYbqjHPpz2Tc=
-----END PUBLIC KEY-----`;

export type VerifyLicenseResult =
  | { valid: true; payload: LicensePayload }
  | { valid: false; error: string };

function decodeSegment(segment: string) {
  return Buffer.from(segment, "base64url");
}

function encodeSegment(buffer: Buffer) {
  return buffer.toString("base64url");
}

export function canonicalizePayload(payload: LicensePayload) {
  return JSON.stringify(payload);
}

export function signLicensePayload(
  payload: LicensePayload,
  privateKeyPem: string,
): string {
  const payloadBuffer = Buffer.from(canonicalizePayload(payload), "utf8");
  const body = encodeSegment(payloadBuffer);
  const signature = encodeSegment(sign(null, payloadBuffer, privateKeyPem));
  return `${LICENSE_PREFIX}.${body}.${signature}`;
}

export function verifyLicenseKey(key: string): VerifyLicenseResult {
  const trimmed = key.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX) {
    return { valid: false, error: "라이선스 키 형식이 올바르지 않습니다." };
  }

  const [, body, signature] = parts;
  let bodyBuffer: Buffer;
  let signatureBuffer: Buffer;
  try {
    bodyBuffer = decodeSegment(body);
    signatureBuffer = decodeSegment(signature);
  } catch {
    return { valid: false, error: "라이선스 키 인코딩이 올바르지 않습니다." };
  }

  const signatureOk = verify(
    null,
    bodyBuffer,
    LICENSE_PUBLIC_KEY_PEM,
    signatureBuffer,
  );
  if (!signatureOk) {
    return { valid: false, error: "라이선스 서명이 유효하지 않습니다." };
  }

  let payload: LicensePayload;
  try {
    payload = JSON.parse(bodyBuffer.toString("utf8")) as LicensePayload;
  } catch {
    return { valid: false, error: "라이선스 본문을 읽을 수 없습니다." };
  }

  if (payload.v !== 1) {
    return { valid: false, error: "지원하지 않는 라이선스 버전입니다." };
  }

  if (payload.expiresAt) {
    const expiresAt = Date.parse(`${payload.expiresAt}T23:59:59.999Z`);
    if (Number.isNaN(expiresAt) || Date.now() > expiresAt) {
      return { valid: false, error: "라이선스가 만료되었습니다." };
    }
  }

  return { valid: true, payload };
}

export function resolveLicenseStatus(state: LicenseState) {
  for (const key of normalizeLicenseKeys(state)) {
    const verified = verifyLicenseKey(key);
    if (verified.valid) {
      return buildLicenseStatus(state, true, verified.payload);
    }
  }
  return buildLicenseStatus(state, false);
}

export { buildLicenseStatus, LICENSE_PREFIX } from "./license-core";
export type { LicensePayload, LicenseState, LicenseStatus } from "./license-core";
export { planUsesPaidApi, TRIAL_API_RUN_LIMIT } from "./license-core";
