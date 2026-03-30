// Global TypeScript types for CyberSentinel AI Platform

export interface User {
  id: number;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface Event {
  id: number;
  event_type: string;
  cmd?: string;
  ip: string;
  severity: 'low' | 'medium' | 'high';
  score: number;
  ts?: string; // Add the missing ts property
  timestamp?: string;
  geo?: string;
  ai_stage?: string;
  ai_intent?: string;
  reputation?: number;
  attacker_type?: string;
  url_path?: string;
  http_method?: string;
  timestamp_utc?: string; // Add the timestamp_utc property
}

export interface ThreatStats {
  summary: {
    total: number;
    critical: number;
    blocked: number;
  };
  feed: Event[];
  trap_distribution: Record<string, number>;
  mitre_distribution: Record<string, number>;
}

export interface SystemHealth {
  cpu?: number | null;
  memory?: number | null;
  latency?: number | null;
  uptime: string;
  components: SystemComponent[];
  notifications: Notification[];
  metrics: {
    total_incidents: number;
    critical_hits: number;
  };
  neural_hive?: {
    status: string;
    latency_ms?: number | null;
    model: string;
    uptime: string;
  };
  resources?: {
    cpu?: number | null;
    memory?: number | null;
    storage?: number | null;
  };
  integrity?: {
    trust_index?: number;
    siem_sync: string;
    audit_status: string;
  };
}

export interface SystemComponent {
  name: string;
  status: 'active' | 'idle' | 'error';
  load?: number;
  icon: string;
}

export interface Notification {
  msg: string;
  severity: 'low' | 'medium' | 'high';
  ts: string;
}

export interface GlobeData {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
}

export interface AttackerProfile {
  ip: string;
  session_id: string;
  alias: string;
  skillScore: number;
  type: string;
  intent: string;
  severity: string;
  event_count: number;
  geo: string;
  last_seen: string;
}

export interface AIPrediction {
  summary: string;
  confidence: number;
  forecast: Array<{
    hour: string;
    predicted_volume: number;
  }>;
  anomalous_probability: number;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginResponse {
  token: string;
  role: string;
}

export interface TerminalResponse {
  output: string;
  prompt: string;
  session_id?: string;
  execution_mode?: string;
  execution_status?: string;
  ai_metadata: {
    intent?: string;
    confidence?: number;
    stage?: string;
    thought?: string;
    explanation?: string;
    mode?: string;
    vulnerabilities?: Array<{
      type?: string;
      severity?: string;
      vector?: string;
    }>;
    mitre_tactic?: string;
    mitre_technique?: string;
    entropy?: number;
  };
}

// UI State types
export interface UIState {
  isFullscreen: boolean;
  searchQuery: string;
  selectedThreat: Event | null;
  theme: 'dark' | 'light';
  sidebarOpen: boolean;
  notifications: Notification[];
}

// WebSocket message types
export interface WSMessage {
  type: 'incident' | 'system' | 'notification';
  data: any;
  timestamp: string;
}

// Form types
export interface LoginForm {
  username: string;
  password: string;
}

export interface SignupForm extends LoginForm {
  confirmPassword: string;
}

export interface BlockIPForm {
  ip: string;
  reason: string;
}

// Chart data types
export interface ChartDataPoint {
  time: string;
  attacks: number;
  [key: string]: any;
}

export interface SeverityData {
  name: string;
  value: number;
  color?: string;
}

// Modern UI component props
export interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'elevated';
  interactive?: boolean;
  glow?: boolean;
}

export interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'email';
  disabled?: boolean;
  className?: string;
}

// Animation variants
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

export const slideInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 }
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Hook return types
export interface UseQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface UseMutationResult<T, V> {
  mutate: (variables: V) => void;
  isLoading: boolean;
  error: Error | null;
  data: T | undefined;
}
