import { clearAuthSession, getAuthToken } from "./auth";

export function safeParseJson<T = unknown>(payload: string): T | null {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

type WebSocketHandlers = {
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
};

type WebSocketOptions = {
  auth?: boolean;
  reconnect?: boolean;
  initialDelayMs?: number;
  maxDelayMs?: number;
};

type ManagedWebSocket = {
  close: () => void;
  send: (message: string) => void;
};

export function createManagedWebSocket(
  url: string,
  handlers: WebSocketHandlers = {},
  options: WebSocketOptions = {}
): ManagedWebSocket {
  const { onOpen, onMessage, onClose, onError } = handlers;

  const {
    auth = true,
    reconnect = true,
    initialDelayMs = 1000,
    maxDelayMs = 15000,
  } = options;

  let socket: WebSocket | null = null;
  let reconnectDelay = initialDelayMs;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closedByUser = false;

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (!reconnect || closedByUser) return;
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(maxDelayMs, reconnectDelay * 2);
  };

  const connect = () => {
    if (closedByUser) return;
    clearReconnectTimer();
    try {
      const targetUrl = new URL(url, window.location.origin);
      socket = new WebSocket(targetUrl.toString());
    } catch (err) {
      onError?.(err as Event);
      scheduleReconnect();
      return;
    }

    socket.onopen = (event) => {
      reconnectDelay = initialDelayMs;
      if (auth) {
        const token = getAuthToken();
        const activeSocket = socket;
        if (token) {
          activeSocket?.send(JSON.stringify({ type: "auth", token }));
        }
      }
      onOpen?.(event);
    };

    socket.onmessage = (event) => {
      onMessage?.(event);
    };

    socket.onerror = (event) => {
      onError?.(event);
    };

    socket.onclose = (event) => {
      onClose?.(event);
      if (auth && event.code === 1008) {
        closedByUser = true;
        clearAuthSession();
        return;
      }
      scheduleReconnect();
    };
  };

  connect();

  return {
    close() {
      closedByUser = true;
      clearReconnectTimer();
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }
    },
    send(message) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    },
  };
}

