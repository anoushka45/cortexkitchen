"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getOrgSettings, updateOrgSettings, OrgSettings } from "@/lib/api";
import { useRouter } from "next/navigation";

const FIELD_CONFIG = [
  {
    section: "Restaurant",
    fields: [
      { key: "capacity",     label: "Seating Capacity",  type: "number", hint: "Total covers" },
      { key: "cuisine_type", label: "Cuisine Type",       type: "text",   hint: "e.g. pizza, italian" },
      { key: "peak_hours",   label: "Peak Service Hours", type: "text",   hint: "e.g. 18:00-22:00" },
      { key: "timezone",     label: "Timezone",           type: "text",   hint: "e.g. Asia/Kolkata" },
    ],
  },
  {
    section: "Planning Thresholds",
    fields: [
      { key: "critic_threshold",        label: "Critic Approval Threshold", type: "number", hint: "0.0 – 1.0 (default 0.7)" },
      { key: "low_stock_threshold_pct", label: "Low Stock Alert %",         type: "number", hint: "Flag items below this % of capacity" },
      { key: "overstock_threshold_pct", label: "Overstock Alert %",         type: "number", hint: "Flag items above this % of capacity" },
    ],
  },
] as const;

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
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <p className="text-neutral-500 text-sm">{error ?? "Loading settings…"}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-white">Workspace Settings</h1>
          <p className="text-neutral-400 text-sm mt-1">{user?.org_name} · {user?.role}</p>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {FIELD_CONFIG.map(({ section, fields }) => (
            <div key={section} className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider mb-5">{section}</h2>
              <div className="space-y-4">
                {fields.map(({ key, label, type, hint }) => (
                  <div key={key}>
                    <label className="block text-sm text-neutral-300 mb-1.5">{label}</label>
                    <input
                      type={type}
                      step={type === "number" ? "any" : undefined}
                      value={settings[key as keyof OrgSettings]}
                      onChange={e => handleChange(key as keyof OrgSettings, e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">{hint}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {error && (
            <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {saved && (
            <div className="text-sm text-green-400 bg-green-400/10 border border-green-400/20 rounded-lg px-3 py-2">
              Settings saved successfully.
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg py-2 text-sm transition-colors"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
