export interface GraphNode {
  id: string;
  label: string;
  kind: string;
  level: number;
  xp: number;
  status: "locked" | "unlocked" | "active";
  dependsOn: { id: string; minLevel: number }[];
  lastCycleId: string | null;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface Graph {
  $schemaVersion: number;
  updatedAt: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Control {
  paused: boolean;
  pauseReason: string | null;
  consecutiveFailures: number;
  failureThreshold: number;
  cadenceHours: number;
  xpPerSuccess: number;
  xpPerLevel: number;
  lastCycleId: string | null;
  lastCycleAt: string | null;
  totalCycles: number;
}

export interface LogEntry {
  ts: string;
  cycleId?: string;
  node?: string;
  result: string;
  reason?: string;
  note?: string;
  levelAfter?: number;
  xpAfter?: number;
}

export interface StateResponse {
  graph: Graph;
  control: Control;
}
