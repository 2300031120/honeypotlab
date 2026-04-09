import React, { useEffect, useMemo, useState } from "react";
import axios, { type AxiosError, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { API_BASE } from "../apiConfig";
import { buildAuthHeaders } from "../utils/auth";

type PersonaId = "GENERAL_SENTINEL" | "FORENSICS" | "ARCHITECT" | "INTEL";

type PersonaOption = {
  id: PersonaId;
  label: PersonaId;
};

type MessageRole = "assistant" | "user";

type ChatMessage = {
  role: MessageRole;
  content: string;
  source?: string;
  persona?: PersonaId | string;
};

type AdvisorResponse = {
  response?: string;
  persona_active?: string;
  response_source?: string;
};

const PERSONAS: PersonaOption[] = [
  { id: "GENERAL_SENTINEL", label: "GENERAL_SENTINEL" },
  { id: "FORENSICS", label: "FORENSICS" },
  { id: "ARCHITECT", label: "ARCHITECT" },
  { id: "INTEL", label: "INTEL" },
];

const INITIAL_MESSAGE =
  "AI companion online. Select a persona and ask any tech or security question.";

function normalizeResponseSource(raw: unknown) {
  const source = String(raw || "").trim().toLowerCase();
  if (!source) return "unknown";
  if (source === "llm") return "llm";
  if (source.startsWith("local")) return "local";
  return source;
}

function sourceBadgeMeta(source: string) {
  if (source === "llm") {
    return {
      label: "LLM",
      bg: "rgba(31, 111, 235, 0.14)",
      border: "rgba(88, 166, 255, 0.55)",
      color: "#58a6ff",
    };
  }
  if (source === "local") {
    return {
      label: "LOCAL FALLBACK",
      bg: "rgba(248, 81, 73, 0.14)",
      border: "rgba(248, 81, 73, 0.45)",
      color: "#f85149",
    };
  }
  return {
    label: "UNKNOWN",
    bg: "rgba(139, 148, 158, 0.12)",
    border: "rgba(139, 148, 158, 0.45)",
    color: "#8b949e",
  };
}

const isAxiosError = (error: unknown): error is AxiosError => axios.isAxiosError(error);

function shouldRetryWithoutApiPrefix(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  const hasResponse = isAxiosError(error) && !!error.response;
  return String(API_BASE).endsWith("/api") && (!hasResponse || status === 404 || status === 405);
}

async function pingBackend(timeoutMs = 20000) {
  const config: AxiosRequestConfig = { timeout: timeoutMs, headers: buildAuthHeaders() };
  try {
    return await axios.get(`${API_BASE}/health`, config);
  } catch (error) {
    if (!shouldRetryWithoutApiPrefix(error)) {
      throw error;
    }
    return axios.get("/health", config);
  }
}

async function askAdvisor(payload: { query: string; persona: string; history: ChatMessage[] }, timeoutMs = 130000) {
  const config: AxiosRequestConfig = {
    timeout: timeoutMs,
    headers: buildAuthHeaders({ "Content-Type": "application/json" }),
  };
  try {
    return await axios.post(`${API_BASE}/ai/expert-advisor`, payload, config);
  } catch (error) {
    if (!shouldRetryWithoutApiPrefix(error)) {
      throw error;
    }
    return axios.post("/ai/expert-advisor", payload, config);
  }
}

function toFriendlyError(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined;
  const message = isAxiosError(error) ? error.message : String((error as Error | undefined)?.message || "");
  if (status === 401) {
    return "Session expired. Please login again.";
  }
  if (status === 404) {
    return "AI endpoint not found. Backend route mapping check cheyyali.";
  }
  if (typeof status === "number" && status >= 500) {
    return "Backend server error. Backend logs check cheyyali.";
  }
  if (String(message || "").toLowerCase().includes("timeout")) {
    return "Request timeout. Try again in a few seconds.";
  }
  return `Request failed: ${message || "Unknown error"}`;
}

const WorkingAIChatBot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: INITIAL_MESSAGE, source: "local", persona: "GENERAL_SENTINEL" },
  ]);
  const [input, setInput] = useState("");
  const [persona, setPersona] = useState<PersonaId>("GENERAL_SENTINEL");
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "failed">("checking");

  const trimmedInput = useMemo(() => String(input || "").trim(), [input]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await pingBackend();
        if (active) setConnectionStatus("connected");
      } catch (error) {
        if (active) {
          setConnectionStatus("failed");
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Backend connectivity failed. ${toFriendlyError(error)}`,
              source: "local",
              persona: "GENERAL_SENTINEL",
            },
          ]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSend = async () => {
    if (!trimmedInput || isLoading) return;
    const userMessage: ChatMessage = { role: "user", content: trimmedInput };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response: AxiosResponse<AdvisorResponse> = await askAdvisor({
        query: trimmedInput,
        persona,
        history: messages.slice(-6),
      });
      const assistantText = String(response?.data?.response || "").trim() || "No response text returned.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantText,
          persona: String(response?.data?.persona_active || persona),
          source: normalizeResponseSource(response?.data?.response_source),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: toFriendlyError(error),
          persona: "GENERAL_SENTINEL",
          source: "local",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const response: AxiosResponse<AdvisorResponse> = await askAdvisor({
        query: "Summarize the top SOC priorities in 3 concise bullets.",
        persona: "GENERAL_SENTINEL",
        history: [],
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `LLM probe complete (${String(response?.data?.response_source || "unknown")}).\n\n${String(response?.data?.response || "")}`,
          persona: String(response?.data?.persona_active || "GENERAL_SENTINEL"),
          source: normalizeResponseSource(response?.data?.response_source),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `AI test failed. ${toFriendlyError(error)}`, source: "local" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSystemSnapshot = async () => {
    setIsLoading(true);
    try {
      const response: AxiosResponse<AdvisorResponse> = await askAdvisor({
        query: "status",
        persona: "GENERAL_SENTINEL",
        history: [],
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `System snapshot:\n\n${String(response?.data?.response || "")}`,
          persona: String(response?.data?.persona_active || "GENERAL_SENTINEL"),
          source: normalizeResponseSource(response?.data?.response_source),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Snapshot failed. ${toFriendlyError(error)}`, source: "local" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "900px",
        margin: "0 auto",
        minHeight: "100vh",
        color: "#e6edf3",
      }}
    >
      <div
        style={{
          border: "1px solid #30363d",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
          background: "#0d1117",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: "8px" }}>AI Companion</div>
        <div style={{ fontSize: "12px", color: "#8b949e" }}>API Base: {API_BASE}</div>
        <div style={{ fontSize: "12px", color: connectionStatus === "connected" ? "#3fb950" : "#f85149" }}>
          Backend: {connectionStatus}
        </div>
      </div>

      <div style={{ marginBottom: "12px", display: "flex", gap: "10px", alignItems: "center" }}>
        <label style={{ fontSize: "13px", color: "#8b949e" }}>Persona</label>
        <select
          value={persona}
          onChange={(e) => setPersona(e.target.value as PersonaId)}
          style={{
            background: "#161b22",
            border: "1px solid #30363d",
            color: "#e6edf3",
            borderRadius: "6px",
            padding: "8px 10px",
          }}
        >
          {PERSONAS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          onClick={testConnection}
          disabled={isLoading}
          style={{
            marginLeft: "auto",
            background: "#1f6feb",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          LLM Test
        </button>
        <button
          onClick={fetchSystemSnapshot}
          disabled={isLoading}
          style={{
            background: "#30363d",
            color: "white",
            border: "none",
            borderRadius: "6px",
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          Snapshot
        </button>
      </div>

      <div
        style={{
          border: "1px solid #30363d",
          borderRadius: "12px",
          background: "#0d1117",
          minHeight: "360px",
          maxHeight: "460px",
          overflowY: "auto",
          padding: "14px",
          marginBottom: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {messages.map((msg, idx) => {
          const source = normalizeResponseSource(msg.source);
          const sourceMeta = sourceBadgeMeta(source);
          return (
          <div
            key={`${msg.role}-${idx}`}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
              border: "1px solid",
              borderColor: msg.role === "user" ? "rgba(88,166,255,0.35)" : "rgba(63,185,80,0.35)",
              background: msg.role === "user" ? "rgba(88,166,255,0.1)" : "rgba(63,185,80,0.08)",
              borderRadius: "10px",
              padding: "10px 12px",
              whiteSpace: "pre-wrap",
              lineHeight: 1.5,
              fontSize: "13px",
            }}
          >
            {msg.role === "assistant" && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "10px", color: "#8b949e", letterSpacing: "0.3px" }}>
                  {String(msg.persona || "GENERAL_SENTINEL")}
                </span>
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    letterSpacing: "0.4px",
                    color: sourceMeta.color,
                    border: `1px solid ${sourceMeta.border}`,
                    borderRadius: "999px",
                    background: sourceMeta.bg,
                    padding: "2px 7px",
                  }}
                >
                  {sourceMeta.label}
                </span>
              </div>
            )}
            {msg.content}
          </div>
          );
        })}
        {isLoading && <div style={{ color: "#58a6ff", fontSize: "12px" }}>Thinking...</div>}
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
          placeholder="Ask any tech or security question..."
          style={{
            flex: 1,
            border: "1px solid #30363d",
            background: "#0d1117",
            color: "#e6edf3",
            borderRadius: "8px",
            padding: "12px",
          }}
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !trimmedInput}
          style={{
            background: trimmedInput ? "#238636" : "#30363d",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "0 16px",
            cursor: trimmedInput ? "pointer" : "not-allowed",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default WorkingAIChatBot;
