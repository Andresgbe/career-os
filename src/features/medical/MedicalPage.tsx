import { useState } from "react";
import HistoryTab from "./tabs/HistoryTab";
import ExamsTab from "./tabs/ExamsTab";
import ContactsTab from "./tabs/ContactsTab";

const TABS = [
  { id: "history", label: "History" },
  { id: "exams", label: "Exams" },
  { id: "contacts", label: "Contacts" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function MedicalPage() {
  const [activeTab, setActiveTab] = useState<TabId>("history");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Medical</h1>
        <p className="text-sm text-muted">
          Track your medical history, exams, and contacts.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px border-b-2 ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "history" && <HistoryTab />}
      {activeTab === "exams" && <ExamsTab />}
      {activeTab === "contacts" && <ContactsTab />}
    </div>
  );
}