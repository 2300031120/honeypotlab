import { getAuthToken } from "./auth";

export function safeParseJson(payload) {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function createManagedWebSocket(url, handlers = {}, options = {}) {
  const {
    onOpen,
    onMessage,
    onClose,
    onError,
  } = handlers;

  const {
    auth = true,
    reconnect = true,
    initialDelayMs = 1000,
    maxDelayMs = 15000,
  } = options;

  let socket = null;
  let reconnectDelay = initialDelayMs;
  let reconnectTimer = null;
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
      const token = auth ? getAuthToken() : "";
      if (token) {
        targetUrl.searchParams.set("token", token);
      }
      socket = new WebSocket(targetUrl.toString());
    } catch (err) {
      onError?.(err);
      scheduleReconnect();
      return;
    }

    socket.onopen = (event) => {
      reconnectDelay = initialDelayMs;
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

