"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  compressSession,
  createSession,
  deleteSession,
  getKnowledgeIndexStatus,
  getRagMode,
  getSessionHistory,
  getSessionTokens,
  listSessions,
  listSkills,
  loadFile,
  renameSession,
  rebuildKnowledgeIndex as rebuildKnowledgeIndexRequest,
  saveFile,
  setRagMode,
  streamChat,
  type CompressionEvent,
  type Evidence,
  type KnowledgeIndexStatus,
  type RetrievalStep,
  type SessionSummary,
  type ToolCall
} from "@/lib/api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolCall[];
  retrievalSteps: RetrievalStep[];
};

type TokenStats = {
  system_tokens: number;
  compressed_context_tokens: number;
  message_tokens: number;
  total_tokens: number;
};

type AppStore = {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  ragMode: boolean;
  skills: Array<{ name: string; description: string; path: string }>;
  editableFiles: string[];
  inspectorPath: string;
  inspectorContent: string;
  inspectorDirty: boolean;
  sidebarWidth: number;
  inspectorWidth: number;
  tokenStats: TokenStats | null;
  knowledgeIndexStatus: KnowledgeIndexStatus | null;
  compressionEvents: CompressionEvent[];
  createNewSession: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  sendMessage: (value: string) => Promise<void>;
  toggleRagMode: () => Promise<void>;
  renameCurrentSession: (title: string) => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;
  loadInspectorFile: (path: string) => Promise<void>;
  updateInspectorContent: (value: string) => void;
  saveInspector: () => Promise<void>;
  compressCurrentSession: () => Promise<void>;
  rebuildKnowledgeIndex: () => Promise<void>;
  setSidebarWidth: (width: number) => void;
  setInspectorWidth: (width: number) => void;
};

const FIXED_FILES = [
  "workspace/SOUL.md",
  "workspace/IDENTITY.md",
  "workspace/USER.md",
  "workspace/AGENTS.md",
  "memory/MEMORY.md",
  "SKILLS_SNAPSHOT.md"
];

const StoreContext = createContext<AppStore | null>(null);

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeEvidence(value: unknown): Evidence | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const scoreValue = item.score;
  const score =
    typeof scoreValue === "number"
      ? scoreValue
      : typeof scoreValue === "string" && scoreValue.trim()
        ? Number(scoreValue)
        : null;

  return {
    source_path: String(item.source_path ?? ""),
    source_type: String(item.source_type ?? ""),
    locator: String(item.locator ?? ""),
    snippet: String(item.snippet ?? ""),
    channel: (item.channel as Evidence["channel"]) ?? "skill",
    score: Number.isFinite(score) ? score : null,
    parent_id: item.parent_id ? String(item.parent_id) : null
  };
}

function normalizeRetrievalStep(value: unknown): RetrievalStep | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const rawResults = Array.isArray(item.results) ? item.results : [];
  const results = rawResults
    .map((entry) => normalizeEvidence(entry))
    .filter((entry): entry is Evidence => entry !== null);

  return {
    kind: item.kind === "memory" ? "memory" : "knowledge",
    stage: String(item.stage ?? "unknown"),
    title: String(item.title ?? "检索结果"),
    message: String(item.message ?? ""),
    results
  };
}

function normalizeCompressionEvent(value: unknown): CompressionEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  return {
    timestamp: Number(item.timestamp ?? 0),
    reason: String(item.reason ?? ""),
    summary: String(item.summary ?? ""),
    pre_compress_tokens: Number(item.pre_compress_tokens ?? 0),
    post_compress_tokens: Number(item.post_compress_tokens ?? 0),
    target_budget_tokens: Number(item.target_budget_tokens ?? 0),
    compressed_message_count: Number(item.compressed_message_count ?? 0),
    kept_recent_turn_count: Number(item.kept_recent_turn_count ?? 0),
    degraded: Boolean(item.degraded ?? false)
  };
}

function toUiMessages(history: Awaited<ReturnType<typeof getSessionHistory>>["messages"]) {
  return history.map((message) => ({
    id: makeId(),
    role: message.role,
    content: message.content ?? "",
    toolCalls: message.tool_calls ?? [],
    retrievalSteps: (message.retrieval_steps ?? [])
      .map((step) => normalizeRetrievalStep(step))
      .filter((step): step is RetrievalStep => step !== null)
  }));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [ragMode, setRagModeState] = useState(false);
  const [skills, setSkills] = useState<Array<{ name: string; description: string; path: string }>>([]);
  const [inspectorPath, setInspectorPath] = useState("memory/MEMORY.md");
  const [inspectorContent, setInspectorContent] = useState("");
  const [inspectorDirty, setInspectorDirty] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(308);
  const [inspectorWidth, setInspectorWidth] = useState(360);
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [knowledgeIndexStatus, setKnowledgeIndexStatus] = useState<KnowledgeIndexStatus | null>(
    null
  );
  const [compressionEvents, setCompressionEvents] = useState<CompressionEvent[]>([]);

  const editableFiles = useMemo(
    () => [...FIXED_FILES, ...skills.map((skill) => skill.path)],
    [skills]
  );

  async function refreshSessions() {
    setSessions(await listSessions());
  }

  async function refreshSkills() {
    setSkills(await listSkills());
  }

  async function refreshKnowledgeIndexStatus() {
    setKnowledgeIndexStatus(await getKnowledgeIndexStatus());
  }

  async function refreshSessionDetails(sessionId: string) {
    const [history, tokens] = await Promise.all([
      getSessionHistory(sessionId),
      getSessionTokens(sessionId)
    ]);
    setMessages(toUiMessages(history.messages));
    setCompressionEvents(
      (history.compression_events ?? [])
        .map((event) => normalizeCompressionEvent(event))
        .filter((event): event is CompressionEvent => event !== null)
        .reverse()
    );
    setTokenStats(tokens);
  }

  async function createNewSession() {
    const created = await createSession();
    await refreshSessions();
    setCurrentSessionId(created.id);
    setMessages([]);
    setCompressionEvents([]);
    setTokenStats(null);
  }

  async function selectSession(sessionId: string) {
    setCurrentSessionId(sessionId);
    await refreshSessionDetails(sessionId);
  }

  async function ensureSession() {
    if (currentSessionId) {
      return currentSessionId;
    }

    const created = await createSession();
    setCurrentSessionId(created.id);
    await refreshSessions();
    return created.id;
  }

  async function sendMessage(value: string) {
    if (!value.trim() || isStreaming) {
      return;
    }

    const sessionId = await ensureSession();
    const userMessage: Message = {
      id: makeId(),
      role: "user",
      content: value.trim(),
      toolCalls: [],
      retrievalSteps: []
    };
    const assistantMessage: Message = {
      id: makeId(),
      role: "assistant",
      content: "",
      toolCalls: [],
      retrievalSteps: []
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    let activeAssistantId = assistantMessage.id;

    const patchAssistant = (updater: (message: Message) => Message) => {
      setMessages((prev) =>
        prev.map((message) => (message.id === activeAssistantId ? updater(message) : message))
      );
    };

    try {
      await streamChat(
        { message: value.trim(), session_id: sessionId },
        {
          onEvent(event, data) {
            if (event === "retrieval") {
              const step = normalizeRetrievalStep(data);
              if (!step) {
                return;
              }
              patchAssistant((message) => ({
                ...message,
                retrievalSteps: [...message.retrievalSteps, step]
              }));
              return;
            }

            if (event === "token") {
              patchAssistant((message) => ({
                ...message,
                content: `${message.content}${String(data.content ?? "")}`
              }));
              return;
            }

            if (event === "tool_start") {
              patchAssistant((message) => ({
                ...message,
                toolCalls: [
                  ...message.toolCalls,
                  {
                    tool: String(data.tool ?? "tool"),
                    input: String(data.input ?? ""),
                    output: ""
                  }
                ]
              }));
              return;
            }

            if (event === "tool_end") {
              patchAssistant((message) => ({
                ...message,
                toolCalls: message.toolCalls.map((toolCall, index, list) =>
                  index === list.length - 1
                    ? { ...toolCall, output: String(data.output ?? "") }
                    : toolCall
                )
              }));
              return;
            }

            if (event === "new_response") {
              const nextAssistant: Message = {
                id: makeId(),
                role: "assistant",
                content: "",
                toolCalls: [],
                retrievalSteps: []
              };
              activeAssistantId = nextAssistant.id;
              setMessages((prev) => [...prev, nextAssistant]);
              return;
            }

            if (event === "done") {
              const finalContent = String(data.content ?? "");
              patchAssistant((message) =>
                message.content
                  ? message
                  : {
                      ...message,
                      content: finalContent
                    }
              );
              return;
            }

            if (event === "compression") {
              const compressionEvent = normalizeCompressionEvent(data);
              if (compressionEvent) {
                setCompressionEvents((prev) => [compressionEvent, ...prev]);
              }
              return;
            }

            if (event === "title") {
              void refreshSessions();
              return;
            }

            if (event === "error") {
              patchAssistant((message) => ({
                ...message,
                content:
                  message.content || `请求失败: ${String(data.error ?? "unknown error")}`
              }));
            }
          }
        }
      );
    } finally {
      setIsStreaming(false);
      await refreshSessions();
      await refreshSessionDetails(sessionId);
    }
  }

  async function toggleRagMode() {
    const next = !ragMode;
    setRagModeState(next);
    try {
      await setRagMode(next);
    } catch (error) {
      setRagModeState(!next);
      throw error;
    }
  }

  async function renameCurrentSession(title: string) {
    if (!currentSessionId || !title.trim()) {
      return;
    }
    await renameSession(currentSessionId, title.trim());
    await refreshSessions();
  }

  async function removeSession(sessionId: string) {
    await deleteSession(sessionId);
    await refreshSessions();
    if (currentSessionId === sessionId) {
      const nextSessions = await listSessions();
      setSessions(nextSessions);
      if (nextSessions.length) {
        setCurrentSessionId(nextSessions[0].id);
        await refreshSessionDetails(nextSessions[0].id);
      } else {
        setCurrentSessionId(null);
        setMessages([]);
        setCompressionEvents([]);
        setTokenStats(null);
      }
    }
  }

  async function loadInspectorFile(path: string) {
    setInspectorPath(path);
    const file = await loadFile(path);
    setInspectorContent(file.content);
    setInspectorDirty(false);
  }

  function updateInspectorContent(value: string) {
    setInspectorContent(value);
    setInspectorDirty(true);
  }

  async function saveInspector() {
    await saveFile(inspectorPath, inspectorContent);
    setInspectorDirty(false);
    await refreshSkills();
  }

  async function compressCurrentSession() {
    if (!currentSessionId) {
      return;
    }
    await compressSession(currentSessionId);
    await refreshSessionDetails(currentSessionId);
    await refreshSessions();
  }

  async function rebuildKnowledgeIndex() {
    await rebuildKnowledgeIndexRequest();
    await refreshKnowledgeIndexStatus();
  }

  useEffect(() => {
    void (async () => {
      const [initialSessions, rag, initialSkills, initialKnowledgeIndexStatus] = await Promise.all([
        listSessions(),
        getRagMode(),
        listSkills(),
        getKnowledgeIndexStatus()
      ]);

      setSessions(initialSessions);
      setRagModeState(rag.enabled);
      setSkills(initialSkills);
      setKnowledgeIndexStatus(initialKnowledgeIndexStatus);

      if (initialSessions.length) {
        setCurrentSessionId(initialSessions[0].id);
        await refreshSessionDetails(initialSessions[0].id);
      } else {
        const created = await createSession();
        setCurrentSessionId(created.id);
        setSessions([created]);
      }

      const file = await loadFile("memory/MEMORY.md");
      setInspectorPath(file.path);
      setInspectorContent(file.content);
    })();
  }, []);

  useEffect(() => {
    if (!knowledgeIndexStatus?.building) {
      return;
    }

    const timer = window.setInterval(() => {
      void getKnowledgeIndexStatus().then((status) => setKnowledgeIndexStatus(status));
    }, 3000);

    return () => window.clearInterval(timer);
  }, [knowledgeIndexStatus?.building]);

  const value: AppStore = {
    sessions,
    currentSessionId,
    messages,
    isStreaming,
    ragMode,
    skills,
    editableFiles,
    inspectorPath,
    inspectorContent,
    inspectorDirty,
    sidebarWidth,
    inspectorWidth,
    tokenStats,
    knowledgeIndexStatus,
    compressionEvents,
    createNewSession,
    selectSession,
    sendMessage,
    toggleRagMode,
    renameCurrentSession,
    removeSession,
    loadInspectorFile,
    updateInspectorContent,
    saveInspector,
    compressCurrentSession,
    rebuildKnowledgeIndex,
    setSidebarWidth,
    setInspectorWidth
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error("useAppStore must be used inside AppProvider");
  }
  return value;
}
