import { createBrowserRouter, Navigate } from "react-router-dom";
import { type ReactNode } from "react";
import { ProtectedRoute, RequireAdmin, RequireModule } from "./RouteGuards";
import AppLayout from "./layout/AppLayout";
import DashboardPage from "../features/dashboard/DashboardPage";
import MotorcyclePage from "../features/motorcycle/MotorcyclePage";
import MedicalPage from "../features/medical/MedicalPage";
import ContentPage from "../features/content/ContentPage";
import GradesPage from "../features/grades/GradesPage";
import SubjectWeeksPage from "../features/grades/SubjectWeeksPage";
import WeekDetailPage from "../features/grades/WeekDetailPage";
import ProjectsPage from "../features/projects/ProjectsPage";
import ProjectWorkspacePage from "../features/projects/ProjectWorkspacePage";
import ProgrammingPage from "../features/programming/ProgrammingPage";
import TasksPage from "../features/tasks/TasksPage";
import InsurancePage from "../features/insurance/InsurancePage";
import FinancePage from "../features/finance/FinancePage";
import PasswordsPage from "../features/passwords/PasswordsPage";
import KnowledgePage from "../features/knowledge/KnowledgePage";
import LoginPage from "../features/auth/LoginPage";
import AdminPage from "../features/admin/AdminPage";

const guard = (module: string, element: ReactNode) => (
  <RequireModule module={module}>{element}</RequireModule>
);

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "motorcycle", element: guard("motorcycle", <MotorcyclePage />) },
      { path: "medical", element: guard("medical", <MedicalPage />) },
      { path: "content", element: guard("content", <ContentPage />) },
      { path: "grades", element: guard("grades", <GradesPage />) },
      {
        path: "grades/:subjectId/weeks",
        element: guard("grades", <SubjectWeeksPage />),
      },
      {
        path: "grades/:subjectId/weeks/:weekNumber",
        element: guard("grades", <WeekDetailPage />),
      },
      { path: "projects", element: guard("projects", <ProjectsPage />) },
      {
        path: "projects/:id",
        element: guard("projects", <ProjectWorkspacePage />),
      },
      { path: "programming", element: guard("programming", <ProgrammingPage />) },
      { path: "tasks", element: guard("tasks", <TasksPage />) },
      { path: "insurance", element: guard("insurance", <InsurancePage />) },
      { path: "finance", element: guard("finance", <FinancePage />) },
      { path: "passwords", element: guard("passwords", <PasswordsPage />) },
      // To Buy now lives as a tab inside Pending; keep old links working
      { path: "tobuy", element: <Navigate to="/tasks" replace /> },
      { path: "knowledge", element: guard("knowledge", <KnowledgePage />) },
      {
        path: "admin",
        element: (
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        ),
      },
      // El chat ahora es una pestaña del dashboard
      { path: "chat", element: <Navigate to="/" replace /> },
    ],
  },
]);