import { Car, HeartPulse, ShieldCheck, Home, Shield, Calendar, Hash, PhoneCall } from "lucide-react";
import type { InsuranceRow, PolicyType } from "../types";

const TYPE_ICON: Record<PolicyType, typeof Shield> = {
  auto: Car,
  health: HeartPulse,
  life: ShieldCheck,
  home: Home,
  other: Shield,
};

const TYPE_STYLE: Record<PolicyType, { color: string; bg: string }> = {
  auto: { color: "text-blue-400", bg: "bg-blue-400/10" },
  health: { color: "text-red-400", bg: "bg-red-400/10" },
  life: { color: "text-purple-400", bg: "bg-purple-400/10" },
  home: { color: "text-amber-400", bg: "bg-amber-400/10" },
  other: { color: "text-primary", bg: "bg-primary/10" },
};

function formatDate(date: string | null): string {
  if (!date) return "";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface InsuranceCardProps {
  policy: InsuranceRow;
  onClick: () => void;
}

export default function InsuranceCard({ policy, onClick }: InsuranceCardProps) {
  const Icon = TYPE_ICON[policy.policy_type];
  const style = TYPE_STYLE[policy.policy_type];
  const emergencyContacts = policy.contacts.filter(
    (c) => c.is_emergency && c.phone
  );

  return (
    <div
      onClick={onClick}
      className="group bg-surface border border-border rounded-xl p-5 hover:border-primary transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${style.bg}`}>
          <Icon className={`w-6 h-6 ${style.color}`} />
        </div>
        <span className="text-xs font-medium px-2.5 py-1 bg-surface-hover rounded-full text-muted capitalize">
          {policy.policy_type}
        </span>
      </div>

      <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors truncate">
        {policy.insurer_name}
      </h3>

      <div className="space-y-1.5">
        {policy.policy_number && (
          <p className="flex items-center gap-2 text-sm text-muted truncate">
            <Hash className="w-3.5 h-3.5 shrink-0" />
            {policy.policy_number}
          </p>
        )}
        {policy.renewal_date && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            Renews {formatDate(policy.renewal_date)}
          </p>
        )}
      </div>

      {emergencyContacts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border space-y-1">
          <p className="text-xs font-medium text-red-400 flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5" />
            Emergency
          </p>
          {emergencyContacts.map((c, index) => (
            <p
              key={index}
              className="text-sm text-foreground truncate pl-5"
            >
              {c.name && <span className="text-muted">{c.name}: </span>}
              {c.phone}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
