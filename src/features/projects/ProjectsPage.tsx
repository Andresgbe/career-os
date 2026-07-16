import { useState } from "react";
import { FolderKanban, Code, Server, Smartphone, ExternalLink } from "lucide-react";

// Mock data for initial presentation
const MOCK_PROJECTS = [
  {
    id: "1",
    title: "E-Commerce Replatforming",
    description: "Migrating the legacy monolithic shop to a modern headless architecture using Next.js and Shopify.",
    status: "In Progress",
    icon: Code,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    id: "2",
    title: "Cloud Infrastructure Setup",
    description: "Setting up automated CI/CD pipelines and provisioning AWS resources via Terraform.",
    status: "Planning",
    icon: Server,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    id: "3",
    title: "Mobile App V2",
    description: "Rewriting the main application in React Native for better cross-platform consistency.",
    status: "On Hold",
    icon: Smartphone,
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
];

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Project Management</h1>
        <p className="text-sm text-muted">
          Manage your IT projects and track their progress.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_PROJECTS.map((project) => {
          const Icon = project.icon;
          return (
            <div
              key={project.id}
              className="group bg-surface border border-border rounded-xl p-5 hover:border-primary transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg"
              onClick={() => {
                // In the future this will navigate to a project detail view
                console.log(`Navigate to project ${project.id}`);
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${project.bg}`}>
                  <Icon className={`w-6 h-6 ${project.color}`} />
                </div>
                <span className="text-xs font-medium px-2.5 py-1 bg-surface-hover rounded-full text-muted">
                  {project.status}
                </span>
              </div>
              
              <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                {project.title}
              </h3>
              <p className="text-sm text-muted line-clamp-2 mb-4">
                {project.description}
              </p>
              
              <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                View Details <ExternalLink className="w-4 h-4 ml-1" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
