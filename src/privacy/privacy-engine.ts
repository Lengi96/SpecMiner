import { readFile } from "node:fs/promises";
import type { PrivacyProfile } from "../models/types.js";
import { defaultPrivacyProfile } from "../config/defaults.js";

export class PrivacyEngine {
  private readonly fieldPatterns: RegExp[];
  private readonly masks: Array<{ name: string; pattern: RegExp; replacement: string }>;

  constructor(private readonly profile: PrivacyProfile = defaultPrivacyProfile) {
    this.fieldPatterns = profile.fieldNamePatterns.map((pattern) => new RegExp(pattern, "i"));
    this.masks = profile.masks.map((mask) => ({
      name: mask.name,
      pattern: new RegExp(mask.pattern, "gi"),
      replacement: mask.replacement
    }));
  }

  static async fromProfilePath(profilePath?: string): Promise<PrivacyEngine> {
    if (!profilePath) {
      return new PrivacyEngine(defaultPrivacyProfile);
    }

    const loaded = JSON.parse(await readFile(profilePath, "utf8")) as PrivacyProfile;
    return new PrivacyEngine(loaded);
  }

  get profileName(): string {
    return this.profile.name;
  }

  maskText(value: string | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    return this.masks.reduce((current, mask) => current.replace(mask.pattern, mask.replacement), value);
  }

  maskUrl(value: string | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    try {
      const url = new URL(value);
      if (url.username) {
        url.username = "[REDACTED]";
      }
      if (url.password) {
        url.password = "[REDACTED]";
      }
      for (const [key, entry] of url.searchParams.entries()) {
        url.searchParams.set(key, this.maskFieldValue(key, entry) ?? "");
      }
      return url.toString();
    } catch {
      return this.maskText(value);
    }
  }

  maskFieldValue(fieldName: string | undefined, value: string | undefined): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (fieldName && this.fieldPatterns.some((pattern) => pattern.test(fieldName))) {
      return "[REDACTED]";
    }

    return this.maskText(value);
  }

  maskUnknown(value: unknown): unknown {
    if (typeof value === "string") {
      return this.maskText(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.maskUnknown(item));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
          key,
          this.fieldPatterns.some((pattern) => pattern.test(key)) ? "[REDACTED]" : this.maskUnknown(entry)
        ])
      );
    }

    return value;
  }
}
