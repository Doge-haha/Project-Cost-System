import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";

import { AppLayout } from "./layout";
import { BillItemsPage } from "../features/bills/bill-items-page";
import { ProjectAuditLogsPage } from "../features/projects/project-audit-logs-page";
import { ProjectAiRecommendationsPage } from "../features/projects/project-ai-recommendations-page";
import { ProjectDetailPage } from "../features/projects/project-detail-page";
import { ProjectJobStatusPage } from "../features/projects/project-job-status-page";
import { ProjectKnowledgePage } from "../features/projects/project-knowledge-page";
import { ProjectProcessDocumentsPage } from "../features/projects/project-process-documents-page";
import { ProjectWorkspaceInboxPage } from "../features/projects/project-workspace-inbox-page";
import { ProjectReviewsPage } from "../features/projects/project-reviews-page";
import { ProjectsPage } from "../features/projects/projects-page";
import { SummaryPage } from "../features/reports/summary-page";

export const appRoutes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/projects" replace />,
      },
      {
        path: "projects",
        element: <ProjectsPage />,
      },
      {
        path: "projects/:projectId",
        element: <ProjectDetailPage />,
      },
      {
        path: "projects/:projectId/inbox",
        element: <ProjectWorkspaceInboxPage />,
      },
      {
        path: "projects/:projectId/reviews",
        element: <ProjectReviewsPage />,
      },
      {
        path: "projects/:projectId/process-documents",
        element: <ProjectProcessDocumentsPage />,
      },
      {
        path: "projects/:projectId/jobs",
        element: <ProjectJobStatusPage />,
      },
      {
        path: "projects/:projectId/audit-logs",
        element: <ProjectAuditLogsPage />,
      },
      {
        path: "projects/:projectId/knowledge",
        element: <ProjectKnowledgePage />,
      },
      {
        path: "projects/:projectId/ai-recommendations",
        element: <ProjectAiRecommendationsPage />,
      },
      {
        path: "projects/:projectId/bill-versions/:versionId/items",
        element: <BillItemsPage />,
      },
      {
        path: "projects/:projectId/summary",
        element: <SummaryPage />,
      },
    ],
  },
];

export const appRouter = createBrowserRouter(appRoutes);
