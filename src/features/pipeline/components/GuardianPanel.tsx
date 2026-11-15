import { useState } from "react";
import { ShieldAlert, Copy, Check, MessageCircle, Send, Radar } from "lucide-react";
import type { DealRow, StageRow } from "../types";
import { daysSince, healthOf, proposedMessage, whatsappLink } from "../types";
import { HealthBadge } from "./DealCard";
import type { Pipeline } from "../usePipeline";

// "Your guardian": the deal that most needs a follow-up (or the one you
// clicked), why, and the message it proposes. Nothing is sent by itself —
// you copy it / open WhatsApp, then mark it as contacted.
export default function GuardianPanel({
  pipeline,
  focus,
  queue,
  onFocus,
}: {
  pipeline: Pipeline;
  focus: DealRow | null;
  queue: DealRow[];
  onFocus: (id: string) => void;
}) {
  const stageOf = (d: DealRow) => pipeline.stages.find((s) => s.id === d.stage_id);

  return (
    <aside className="rounded-3xl border border-border bg-surface flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-background/40">
        <span className="flex items-center gap-2 font-bold">
          <ShieldAlert className="w-4 h-4 text-primary-hover" />
          Your guardian
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-emerald-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Watching
        </span>
      </div>

      {focus ? (
        <FocusedDeal key={`${focus.id}-${focus.updated_at}`} deal={focus} stage={stageOf(focus)} pipeline={pipeline} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6 py-12">
          <span className="w-12 h-12 rounded-2xl bg-emerald-400/10 text-emerald-300 flex items-center justify-center">
            <Radar className="w-6 h-6" />
          </span>
          <p className="font-semibold">Everything is on time</p>
          <p className="text-sm text-muted">No deal has gone past its stage's rule. Click any card to review it here.</p>
        </div>
      )}

      {queue.length > 0 && (
        <div className="border-t border-border px-3 py-3 space-y-1">
          <p className="px-2 pb-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">
            Also needs attention · {queue.length}
          </p>
          {queue.map((d) => {
            const s = stageOf(d);
            const over = daysSince(d.last_activity_at) - (s?.max_days ?? 0);
            return (
              <button
                key={d.id}
                onClick={() => onFocus(d.id)}
                className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.04]"
              >
                <span className="text-sm truncate">{d.name}</span>
                <span className="text-[11px] text-red-300 tabular-nums whitespace-nowrap">
                  {s?.name} · +{over}d
                </span>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}

function FocusedDeal({ deal, stage, pipeline }: { deal: DealRow; stage?: StageRow; pipeline: Pipeline }) {
  const [message, setMessage] = useState(() => proposedMessage(deal, stage));
  const [copied, setCopied] = useState(false);
  const days = daysSince(deal.last_activity_at);
  const health = healthOf(deal, stage);
  const over = days - (stage?.max_days ?? 0);
  const wa = whatsappLink(deal.contact, message);
  const edited = message !== proposedMessage(deal, stage);

  const rows: [string, string][] = [
    ["Last movement", new Date(deal.last_activity_at).toLocaleDateString("en", { month: "short", day: "numeric" })],
    ["Stage", stage?.name ?? "—"],
    ["Rule", stage ? `Max ${stage.max_days} ${stage.max_days === 1 ? "day" : "days"}` : "—"],
    ["Over by", over > 0 ? `${over} ${over === 1 ? "day" : "days"}` : "—"],
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="flex-1 px-5 py-5 space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <HealthBadge health={health} />
          {deal.channel && <span className="text-[11px] text-muted uppercase tracking-wider">{deal.channel}</span>}
        </div>
        <h2 className="text-[22px] font-extrabold tracking-tight leading-tight">
          {deal.name}: {days} {days === 1 ? "day" : "days"} with no movement
        </h2>
        {deal.note && <p className="text-sm text-muted">Last: {deal.note}</p>}
      </div>

      <dl className="divide-y divide-border rounded-2xl border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between px-3.5 py-2 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className={`font-semibold ${k === "Over by" && over > 0 ? "text-red-300" : ""}`}>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2">
        <label className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">Suggested message</label>
        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-2xl border border-primary/30 bg-primary/[0.06] px-3.5 py-3 text-sm leading-relaxed outline-none focus:border-primary resize-none"
        />
        {edited && (
          <button
            onClick={() => pipeline.saveDeal(deal.id, { suggested_message: message })}
            className="text-xs font-semibold text-primary-hover hover:underline"
          >
            Keep this version as the suggestion
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={copy}
          className="flex items-center justify-center gap-1.5 h-10 rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground hover:border-[#3a3a44] transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 h-10 rounded-xl border border-emerald-400/40 bg-emerald-400/10 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/20 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </a>
        ) : (
          <span className="flex items-center justify-center h-10 rounded-xl border border-dashed border-border text-xs text-muted text-center px-2">
            Add a phone for WhatsApp
          </span>
        )}
        <button
          onClick={() => pipeline.markContacted(deal, message)}
          className="col-span-2 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
        >
          <Send className="w-4 h-4" />
          I followed up — restart the clock
        </button>
      </div>
      <p className="text-center text-[11px] text-muted">You decide what gets sent. The guardian never sends anything.</p>
    </div>
  );
}
