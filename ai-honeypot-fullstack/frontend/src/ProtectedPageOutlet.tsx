import React, { lazy } from "react";
import { Navigate } from "react-router-dom";

const Terminal = lazy(() => import("./Terminal"));
const Dashboard = lazy(() => import("./Dashboard"));
const TelemetryCenter = lazy(() => import("./TelemetryCenter"));
const Sites = lazy(() => import("./Sites"));
const ForensicsPage = lazy(() => import("./ForensicsPage"));
const ThreatIntel = lazy(() => import("./ThreatIntel"));
const MitreMapping = lazy(() => import("./MitreMapping"));
const AttackerProfile = lazy(() => import("./AttackerProfile"));
const DeceptionConfig = lazy(() => import("./DeceptionConfig"));
const AttackGraph = lazy(() => import("./AttackGraph"));
const SystemStatus = lazy(() => import("./SystemStatus"));
const Simulator = lazy(() => import("./Simulator"));
const WorkingAIChatBot = lazy(() => import("./components/WorkingAIChatBot"));
const AuditLog = lazy(() => import("./AuditLog"));
const AdminLeads = lazy(() => import("./AdminLeads"));
const LabArchitecture = lazy(() => import("./Architecture"));
const About = lazy(() => import("./About"));
const UrlScanner = lazy(() => import("./UrlScanner"));
const Analytics = lazy(() => import("./Analytics"));

const PAGE_MAP = {
  terminal: Terminal,
  dashboard: Dashboard,
  telemetry: TelemetryCenter,
  sites: Sites,
  forensics: ForensicsPage,
  intelligence: ThreatIntel,
  mapping: MitreMapping,
  profiling: AttackerProfile,
  deception: DeceptionConfig,
  graph: AttackGraph,
  status: SystemStatus,
  simulator: Simulator,
  ai_companion: WorkingAIChatBot,
  audit: AuditLog,
  admin_leads: AdminLeads,
  lab_architecture: LabArchitecture,
  about: About,
  url_scanner: UrlScanner,
  analytics: Analytics,
};

type ProtectedPageOutletProps = {
  page: keyof typeof PAGE_MAP;
};

export default function ProtectedPageOutlet({ page }: ProtectedPageOutletProps) {
  const Page = PAGE_MAP[page];
  if (!Page) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Page />;
}
