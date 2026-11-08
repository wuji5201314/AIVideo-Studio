/**
 * API client for AIVideo-Studio backend.
 * Adheres to Alibaba 5-digit error code ResultEnvelope standard.
 */

export interface ResultEnvelope<T> {
  code: string;
  message: string;
  data: T;
  request_id: string;
}

export interface ShotItem {
  shot_id: string;
  headline: string;
  narration: string;
  visual_prompt: string;
  search_terms: string[];
  est_duration: number;
  is_locked: boolean;
  audio_path?: string;
  visual_path?: string;
  clip_path?: string;
}

export interface ScriptOutput {
  title: string;
  summary: string;
  tags: string[];
  shots: ShotItem[];
}

export interface DAGNode {
  project_id: string;
  node_key: string;
  node_type: string;
  shot_id?: string;
  order_no: number;
  gate_enabled: number;
  status: "PENDING" | "READY" | "RUNNING" | "WAITING_GATE" | "SUCCEEDED" | "STALE" | "FAILED";
  config_json: string;
  locked: number;
  current_rev_id?: string;
  updated_at: string;
}

export interface ProjectData {
  id: string;
  title: string;
  brief: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetails {
  project: ProjectData;
  nodes: DAGNode[];
}

export interface PlanAction {
  node_key: string;
  action: "REUSE" | "BUILD" | "REFINE" | "PATCH";
  reason: string;
  cost_type: string;
  affected_shot_ids: string[];
}

export interface ExecutionPlan {
  project_id: string;
  base_revision: string;
  actions: PlanAction[];
  estimated_reuse_count: number;
  estimated_build_count: number;
}

export interface OperatorMeta {
  op_id: string;
  name: string;
  category: string;
  description: string;
  is_free_local: boolean;
  cost_type: string;
  input_schema: Record<string, unknown>;
}

export interface AssetItem {
  sha256: string;
  kind: "audio" | "video" | "image" | "script" | string;
  title: string;
  rel_path: string;
  file_path: string;
  size_bytes: number;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface WorkbenchSeed {
  prompt: string;
  voiceName?: string;
  aspectRatio?: string;
  mediaPath?: string;
  mediaType?: "audio" | "video" | "image" | "script";
  shots?: ShotItem[];
  sourceToolName?: string;
}

export const API_BASE =
  typeof window !== "undefined" && window.location.port === "5173"
    ? ""
    : "http://127.0.0.1:8010";

export function getStreamUrl(pathOrSha256: string): string {
  if (/^[a-fA-F0-9]{64}$/.test(pathOrSha256)) {
    return `${API_BASE}/api/v2/assets/stream?sha256=${encodeURIComponent(pathOrSha256)}`;
  }
  return `${API_BASE}/api/v2/assets/stream?path=${encodeURIComponent(pathOrSha256)}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  let resp: Response;
  try {
    resp = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (_err) {
    throw new Error("无法连接后端服务 (8010 端口)，请确认后端 API 服务已正常运行。");
  }

  const body: ResultEnvelope<T> = await resp.json();
  if (body.code !== "00000") {
    throw new Error(`[${body.code}] ${body.message}`);
  }
  return body.data;
}

export const api = {
  // Projects & Workflow
  createProject: (title: string, brief: string) =>
    request<{ project_id: string; title: string }>("/api/v2/projects", {
      method: "POST",
      body: JSON.stringify({ title, brief }),
    }),

  listProjects: () => request<ProjectData[]>("/api/v2/projects"),

  getProjectDAG: (projectId: string) =>
    request<ProjectDetails>(`/api/v2/projects/${projectId}`),

  patchNodeConfig: (
    projectId: string,
    nodeKey: string,
    payload: { gate_enabled?: boolean; locked?: boolean; config?: Record<string, unknown> }
  ) =>
    request<{ node_key: string; stale_downstream: string[] }>(
      `/api/v2/projects/${projectId}/nodes/${nodeKey}/config`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  submitFeedback: (
    projectId: string,
    nodeKey: string,
    payload: {
      base_rev_id: string;
      mode: "APPROVE" | "PATCH" | "REFINE" | "REGENERATE";
      instruction?: string;
      locked_keys?: string[];
      manual_patches?: Record<string, unknown>;
    }
  ) =>
    request<{ feedback_id: string; plan: ExecutionPlan }>(
      `/api/v2/projects/${projectId}/nodes/${nodeKey}/feedback`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  // Operators
  listOperators: () => request<OperatorMeta[]>("/api/v2/operators"),

  executeOperator: <TOutput = unknown>(
    opId: string,
    inputData: Record<string, unknown>,
    config: Record<string, unknown> = {}
  ) =>
    request<TOutput>(`/api/v2/operators/${opId}/execute`, {
      method: "POST",
      body: JSON.stringify({ input: inputData, config }),
    }),

  // Assets & CAS Library
  listAssets: (kind?: string) =>
    request<AssetItem[]>(
      kind ? `/api/v2/assets?kind=${encodeURIComponent(kind)}` : "/api/v2/assets"
    ),

  saveAsset: (payload: {
    file_path?: string;
    kind: string;
    title: string;
    meta?: Record<string, unknown>;
  }) =>
    request<{ sha256: string; kind: string; title: string; size_bytes: number; file_path: string }>(
      "/api/v2/assets/save",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),
};
