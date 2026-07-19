import { createBrowserRouter, Navigate } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import AppLayout from "./layout/AppLayout";
import DashboardPage from "../features/dashboard/DashboardPage";
import MotorcyclePage from "../features/motorcycle/MotorcyclePage";
import MedicalPage from "../features/medical/MedicalPage";
import ContentPage from "../features/content/ContentPage";
import GradesPage from "../features/grades/GradesPage";
import ProjectsPage from "../features/projects/ProjectsPage";
import ProgrammingPage from "../features/programming/ProgrammingPage";
import TasksPage from "../features/tasks/TasksPage";
import InsurancePage from "../features/insurance/InsurancePage";
import FinancePage from "../features/finance/FinancePage";
import WorkPage from "../features/work/WorkPage";
import LoginPage from "../features/auth/LoginPage";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

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
      { path: "motorcycle", element: <MotorcyclePage /> },
      { path: "medical", element: <MedicalPage /> },
      { path: "content", element: <ContentPage /> },
      { path: "grades", element: <GradesPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "programming", element: <ProgrammingPage /> },
      { path: "tasks", element: <TasksPage /> },
      { path: "insurance", element: <InsurancePage /> },
      { path: "finance", element: <FinancePage /> },
      { path: "work", element: <WorkPage /> },
    ],
  },
]);