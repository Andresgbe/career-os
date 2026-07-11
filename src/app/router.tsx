import { createBrowserRouter } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import DashboardPage from "../features/dashboard/DashboardPage";
import MotorcyclePage from "../features/motorcycle/MotorcyclePage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "motorcycle", element: <MotorcyclePage /> },
    ],
  },
]);