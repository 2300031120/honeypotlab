import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  ThreatStats,
  Event,
  GlobeData,
  AIPrediction,
  SystemHealth
} from '../types';

interface DashboardState {
  // Core data
  stats: ThreatStats;
  chartData: Array<{ time: string; attacks: number }>;
  severityData: Array<{ name: string; value: number; color?: string }>;
  mitreData: Array<{ name: string; value: number }>;
  httpTrapFeed: Event[];
  currentTime: string;
  globeData: GlobeData[];
  arcsData: any[];
  predictions: AIPrediction | null;
  healthData: SystemHealth;

  // UI state
  searchQuery: string;
  isFullscreen: boolean;
  selectedThreat: Event | null;
  theme: 'dark' | 'light';
  sidebarOpen: boolean;

  // Actions
  setStats: (stats: Partial<ThreatStats>) => void;
  setChartData: (data: Array<{ time: string; attacks: number }>) => void;
  setSeverityData: (data: Array<{ name: string; value: number; color?: string }>) => void;
  setMitreData: (data: Array<{ name: string; value: number }>) => void;
  setHttpTrapFeed: (feed: Event[]) => void;
  setCurrentTime: (time: string) => void;
  setGlobeData: (data: GlobeData[]) => void;
  setArcsData: (data: any[]) => void;
  setPredictions: (predictions: AIPrediction | null) => void;
  setHealthData: (health: SystemHealth) => void;
  setSearchQuery: (query: string) => void;
  setIsFullscreen: (fullscreen: boolean) => void;
  setSelectedThreat: (threat: Event | null) => void;
  toggleFullscreen: () => void;
  handleThreatSelection: (threat: Event) => void;
}

export const useStore = create<DashboardState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        stats: {
          summary: { total: 0, critical: 0, blocked: 0 },
          feed: [],
          trap_distribution: {},
          mitre_distribution: {}
        },
        chartData: [],
        severityData: [],
        mitreData: [],
        httpTrapFeed: [],
        currentTime: new Date().toUTCString(),
        globeData: [],
        arcsData: [],
        predictions: null,
        healthData: {
          cpu: null,
          memory: null,
          latency: null,
          uptime: '0d 0h 0m',
          components: [],
          notifications: [],
          metrics: {
            total_incidents: 0,
            critical_hits: 0
          }
        },

        // UI state
        searchQuery: '',
        isFullscreen: false,
        selectedThreat: null,
        theme: 'dark',
        sidebarOpen: true,

        // Actions
        setStats: (newStats) =>
          set((state) => ({
            stats: { ...state.stats, ...newStats }
          })),

        setChartData: (data) => set({ chartData: data }),

        setSeverityData: (data) => set({ severityData: data }),

        setMitreData: (data) => set({ mitreData: data }),

        setHttpTrapFeed: (feed) => set({ httpTrapFeed: feed }),

        setCurrentTime: (time) => set({ currentTime: time }),

        setGlobeData: (data) => set({ globeData: data }),

        setArcsData: (data) => set({ arcsData: data }),

        setPredictions: (predictions) => set({ predictions }),

        setHealthData: (health) => set({ healthData: health }),

        setSearchQuery: (query) => set({ searchQuery: query }),

        setIsFullscreen: (fullscreen) => set({ isFullscreen: fullscreen }),

        setSelectedThreat: (threat) => set({ selectedThreat: threat }),

        toggleFullscreen: () =>
          set((state) => ({ isFullscreen: !state.isFullscreen })),

        handleThreatSelection: (threat) =>
          set({ selectedThreat: threat })
      }),
      {
        name: 'cybersentinel-store',
        partialize: (state) => ({
          theme: state.theme,
          sidebarOpen: state.sidebarOpen,
          isFullscreen: state.isFullscreen
        })
      }
    ),
    {
      name: 'cybersentinel-devtools'
    }
  )
);

// Query hooks for API calls
export const useDashboardData = () => {
  const {
    stats,
    chartData,
    severityData,
    mitreData,
    httpTrapFeed,
    globeData,
    arcsData,
    predictions,
    healthData
  } = useStore();

  return {
    stats,
    chartData,
    severityData,
    mitreData,
    httpTrapFeed,
    globeData,
    arcsData,
    predictions,
    healthData
  };
};

export const useUIState = () => {
  const {
    searchQuery,
    isFullscreen,
    selectedThreat,
    theme,
    sidebarOpen,
    setSearchQuery,
    setIsFullscreen,
    setSelectedThreat,
    toggleFullscreen,
    handleThreatSelection
  } = useStore();

  return {
    searchQuery,
    isFullscreen,
    selectedThreat,
    theme,
    sidebarOpen,
    setSearchQuery,
    setIsFullscreen,
    setSelectedThreat,
    toggleFullscreen,
    handleThreatSelection
  };
};
