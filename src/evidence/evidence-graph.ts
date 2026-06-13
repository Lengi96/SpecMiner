import type { Evidence, PageSnapshot, UserAction } from "../models/types.js";

export interface EvidenceGraph {
  evidence: Evidence[];
  events: UserAction[];
  pages: PageSnapshot[];
  evidenceById: Map<string, Evidence>;
}

export function buildEvidenceGraph(evidence: Evidence[], events: UserAction[], pages: PageSnapshot[]): EvidenceGraph {
  return {
    evidence,
    events,
    pages,
    evidenceById: new Map(evidence.map((item) => [item.id, item]))
  };
}

export function evidenceForUrl(graph: EvidenceGraph, url: string): Evidence[] {
  return graph.evidence.filter((item) => item.url === url);
}
