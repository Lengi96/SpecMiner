import type { PrivacyProfile } from "../models/types.js";

export const TOOL_VERSION = "0.1.0";

export const defaultPrivacyProfile: PrivacyProfile = {
  name: "default",
  fieldNamePatterns: [
    "password",
    "passwort",
    "token",
    "secret",
    "api[_-]?key",
    "ssn",
    "steuer",
    "iban",
    "credit",
    "card",
    "email",
    "phone",
    "telefon"
  ],
  masks: [
    {
      name: "email",
      pattern: "\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b",
      replacement: "[EMAIL]"
    },
    {
      name: "phone",
      pattern: "\\b(?:\\+?\\d[\\d .()/-]{7,}\\d)\\b",
      replacement: "[PHONE]"
    },
    {
      name: "credit-card",
      pattern: "\\b(?:\\d[ -]*?){13,19}\\b",
      replacement: "[CARD]"
    },
    {
      name: "iban",
      pattern: "\\b[A-Z]{2}\\d{2}[A-Z0-9]{11,30}\\b",
      replacement: "[IBAN]"
    },
    {
      name: "jwt",
      pattern: "\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b",
      replacement: "[TOKEN]"
    }
  ]
};
