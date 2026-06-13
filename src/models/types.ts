export type EvidenceKind =
  | "url"
  | "screenshot"
  | "visible_text"
  | "form"
  | "field"
  | "button"
  | "table"
  | "error_message"
  | "user_action"
  | "accessibility"
  | "network";

export type ClaimKind = "observation" | "derived" | "assumption" | "open_question";

export type SpecCategory =
  | "system"
  | "module"
  | "user_story"
  | "acceptance_criteria"
  | "business_rule"
  | "test_case";

export type BrowserName = "chromium" | "firefox" | "webkit";

export interface Run {
  id: string;
  startedAt: string;
  baseUrl: string;
  toolVersion: string;
  privacyProfile: string;
}

export interface Evidence {
  id: string;
  runId: string;
  kind: EvidenceKind;
  url: string;
  timestamp: string;
  selector?: string;
  role?: string;
  label?: string;
  textMasked?: string;
  artifactPath?: string;
  metadata: Record<string, unknown>;
}

export interface UserAction {
  id: string;
  type: "click" | "fill" | "select" | "submit" | "navigate" | "keypress" | "note" | "capture";
  targetEvidenceId?: string;
  valueMasked?: string;
  beforeUrl: string;
  afterUrl?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SpecClaim {
  id: string;
  kind: ClaimKind;
  category: SpecCategory;
  text: string;
  evidenceIds: string[];
  confidence: "high" | "medium" | "low";
}

export interface PageSnapshot {
  id: string;
  runId: string;
  url: string;
  title: string;
  capturedAt: string;
  screenshotEvidenceId?: string;
  accessibilityEvidenceId?: string;
  visibleTexts: string[];
  forms: FormObservation[];
  buttons: ElementObservation[];
  tables: TableObservation[];
  errorMessages: string[];
  evidenceIds: string[];
}

export interface FormObservation {
  selector: string;
  label?: string;
  method?: string;
  action?: string;
  fields: FieldObservation[];
  buttons: ElementObservation[];
}

export interface FieldObservation {
  selector: string;
  name?: string;
  label?: string;
  type?: string;
  required: boolean;
  placeholder?: string;
  valueMasked?: string;
}

export interface ElementObservation {
  selector: string;
  role?: string;
  label?: string;
  textMasked?: string;
  disabled?: boolean;
}

export interface TableObservation {
  selector: string;
  caption?: string;
  headers: string[];
  rowCount: number;
  sampleRows: string[][];
}

export interface SpecDocument {
  run: Run;
  generatedAt: string;
  summary: string;
  claims: SpecClaim[];
  modules: ModuleSpec[];
  openQuestions: SpecClaim[];
}

export interface ModuleSpec {
  name: string;
  urlPatterns: string[];
  evidenceIds: string[];
  stories: SpecClaim[];
  acceptanceCriteria: SpecClaim[];
  businessRules: SpecClaim[];
  testCases: SpecClaim[];
}

export interface RecordOptions {
  url: string;
  outDir: string;
  browser: BrowserName;
  headed: boolean;
  profilePath?: string;
  raw: boolean;
  stopAfterMs?: number;
}

export interface CrawlOptions {
  url: string;
  outDir: string;
  browser: BrowserName;
  headed: boolean;
  profilePath?: string;
  raw: boolean;
  maxPages: number;
}

export interface GenerateOptions {
  runDir: string;
  formats: Array<"markdown" | "json" | "html">;
  gherkin: boolean;
  review: boolean;
  playwright: boolean;
  provider: string;
}

export interface PrivacyProfile {
  name: string;
  masks: PrivacyMask[];
  fieldNamePatterns: string[];
}

export interface PrivacyMask {
  name: string;
  pattern: string;
  replacement: string;
}
