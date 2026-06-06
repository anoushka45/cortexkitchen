"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getOrgSettings, updateOrgSettings, OrgSettings } from "@/lib/api";
import { useRouter } from "next/navigation";

interface FieldDef {
  key: keyof OrgSettings;
  label: string;
  type: "text" | "number";
  hint: string;
  min?: number;
  max?: number;
}

const FIELD_CONFIG: { section: string; fields: FieldDef[] }[] = [
  {
    section: "Restaurant",
    fields: [
      { key: "capacity",     label: "Seating Capacity",  type: "number", min: 1,             hint: "Total covers" },
      { key: "cuisine_type", label: "Cuisine Type",       type: "text",                       hint: "e.g. pizza, italian" },
      { key: "peak_hours",   label: "Peak Service Hours", type: "text",                       hint: "e.g. 18:00-22:00" },
      { key: "timezone",     label: "Timezone",           type: "text",                       hint: "e.g. Asia/Kolkata" },
    ],
  },
  {
    section: "Planning Thresholds",
    fields: [
      { key: "critic_threshold",        label: "Critic Approval Threshold", type: "number", min: 0, max: 1,   hint: "0.0 – 1.0 (default 0.7)" },
      { key: "low_stock_threshold_pct", label: "Low Stock Alert %",         type: "number", min: 0, max: 100, hint: "Flag items below this % of capacity" },
      { key: "overstock_threshold_pct", label: "Overstock Alert %",         type: "number", min: 0, max: 100, hint: "Flag items above this % of capacity" },
    ],
  },
];

function validateSettings(s: OrgSettings): string | null {
  if (s.capacity < 1)
    return "Seating capacity must be at least 1.";
  if (s.critic_threshold < 0 || s.critic_threshold > 1)
    return "Critic threshold must be between 0.0 and 1.0.";
  if (s.low_stock_threshold_pct < 0 || s.low_stock_threshold_pct > 100)
    return "Low stock alert % must be between 0 and 100.";
  if (s.overstock_threshold_pct < 0 || s.overstock_threshold_pct > 100)
    return "Overstock alert % must be between 0 and 100.";
  return null;
}

const INPUT_CLS = "w-full bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-ember-500/50 focus:border-ember-500/60 transition-colors";

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "owner") { router.push("/"); return; }
    getOrgSettings().then(r => setSettings(r.settings)).catch(e => setError(e.message));
  }, [user, router]);

  function handleChange(key: keyof OrgSettings, value: string) {
    if (!settings) return;
    const prev = settings[key];
    const parsed = typeof prev === "number" ? parseFloat(value) || 0 : value;
    setSettings({ ...settings, [key]: parsed });
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    const validationErr = validateSettings(settings);
    if (validationErr) { setError(validationErr); return; }
    setSaving(true); setError(null); setSaved(false);
    try {
      const res = await updateOrgSettings(settings);
      setSettings(res.settings);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return (
    <div className="min-h-screen bg-[#09111f] flex items-center justify-center">
      <p className="text-slate-500 text-sm">{error ?? "Loading settings..."}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09111f] px-4 py-10 text-slate-100">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 stagger-1">
          <p className="text-xs font-mono uppercase tracking-[0.22em] text-ember-300">configuration</p>
          <h1 className="mt-2 text-xl font-bold text-white">Workspace Settings</h1>
          <p className="text-slate-500 text-sm mt-1">{user?.org_name}  -  {user?.role}</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {FIELD_CONFIG.map(({ section, fields }, si) => (
            <div key={section} className={`bg-[#0d1320] border border-white/10 rounded-xl p-6 transition-all hover:border-white/20 stagger-${si + 2}`}>
              <h2 className="text-xs font-mono uppercase tracking-[0.18em] text-slate-500 mb-5">{section}</h2>
              <div className="space-y-4">
                {fields.map(({ key, label, type, hint, min, max }) => (
                  <div key={key}>
                    <label className="block text-sm text-slate-400 mb-1.5">{label}</label>
                    <input
                      type={type}
                      min={min}
                      max={max}
                      step={type === "number" ? "any" : undefined}
                      value={settings[key]}
                      onChange={e => handleChange(key, e.target.value)}
                      className={INPUT_CLS}
                    />
                    <p className="text-xs text-slate-600 mt-1">{hint}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {error && (
            <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {saved && (
            <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              Settings saved successfully.
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-ember-600 hover:bg-ember-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
