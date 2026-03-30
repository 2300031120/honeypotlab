import React, { lazy } from "react";
import { Navigate } from "react-router-dom";

const Terminal = lazy(() => import("./Terminal.jsx"));
const Dashboard = lazy(() => import("./Dashboard.jsx"));
const TelemetryCenter = lazy(() => import("./TelemetryCenter.jsx"));
const Sites = lazy(() => import("./Sites.jsx"));
const ForensicsPage = lazy(() => import("./ForensicsPage.jsx"));
const ThreatIntel = lazy(() => import("./ThreatIntel.jsx"));
const MitreMapping = lazy(() => import("./MitreMapping.jsx"));
const AttackerProfile = lazy(() => import("./AttackerProfile.jsx"));
const DeceptionConfig = lazy(() => import("./DeceptionConfig.jsx"));
const AttackGraph = lazy(() => import("./AttackGraph.jsx"));
const SystemStatus = lazy(() => import("./SystemStatus.jsx"));
const Simulator = lazy(() => import("./Simulator.jsx"));
const WorkingAIChatBot = lazy(() => import("./components/WorkingAIChatBot.jsx"));
const AuditLog = lazy(() => import("./AuditLog.jsx"));
const AdminLeads = lazy(() => import("./AdminLeads.jsx"));
const LabArchitecture = lazy(() => import("./Architecture.jsx"));
const About = lazy(() => import("./About.jsx"));
const UrlScanner = lazy(() => import("./UrlScanner.jsx"));

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
};

export default function ProtectedPageOutlet({ page }) {
  const Page = PAGE_MAP[page];
  if (!Page) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Page />;
}
