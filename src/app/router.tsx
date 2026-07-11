import { createBrowserRouter, Navigate } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import AppLayout from "./layout/AppLayout";
import DashboardPage from "../features/dashboard/DashboardPage";
import MotorcyclePage from "../features/motorcycle/MotorcyclePage";
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
    ],
  },
]);