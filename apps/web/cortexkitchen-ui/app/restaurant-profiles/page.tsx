"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  listRestaurantProfiles,
  createRestaurantProfile,
  updateRestaurantProfile,
  deleteRestaurantProfile,
  RestaurantProfile,
  RestaurantProfileCreate,
} from "@/lib/api";

const EMPTY_FORM: RestaurantProfileCreate = {
  name: "",
  cuisine: "pizza",
  capacity: 70,
  peak_hours: "18:00-22:00",
  timezone: "Asia/Kolkata",
};

const INPUT_CLS = "w-full bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-ember-500/50 focus:border-ember-500/60 transition-colors";

export default function RestaurantProfilesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [profiles, setProfiles] = useState<RestaurantProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<(RestaurantProfileCreate & { id?: number }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "owner") { router.push("/"); return; }
    load();
  }, [user, router]);

  async function load() {
    setLoading(true);
    try {
      setProfiles(await listRestaurantProfiles());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profiles.");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() { setForm({ ...EMPTY_FORM }); setFormError(null); }
  function openEdit(p: RestaurantProfile) {
    setForm({ id: p.id, name: p.name, cuisine: p.cuisine, capacity: p.capacity, peak_hours: p.peak_hours, timezone: p.timezone });
    setFormError(null);
  }
  function closeForm() { setForm(null); setFormError(null); }

  function handleField(key: keyof RestaurantProfileCreate, value: string) {
    if (!form) return;
    const parsed = key === "capacity" ? (parseInt(value, 10) || 0) : value;
    setForm({ ...form, [key]: parsed });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true); setFormError(null);
    try {
      const { id, ...body } = form;
      if (id) await updateRestaurantProfile(id, body);
      else    await createRestaurantProfile(body);
      closeForm();
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this restaurant profile?")) return;
    try {
      await deleteRestaurantProfile(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#09111f] flex items-center justify-center">
      <p className="text-slate-500 text-sm">Loading profiles...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09111f] px-4 py-10 text-slate-100">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-center justify-between stagger-1">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.22em] text-ember-300">configuration</p>
            <h1 className="mt-2 text-xl font-bold text-white">Restaurant Profiles</h1>
            <p className="text-slate-500 text-sm mt-1">
              Named profiles override org-level capacity and peak hours for a planning run.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="bg-ember-600 hover:bg-ember-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            + New Profile
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</div>
        )}

        {profiles.length === 0 ? (
          <div className={`bg-[#0d1320] border border-white/10 rounded-xl p-10 text-center stagger-2`}>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
              <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-slate-300 text-sm font-medium">No profiles yet</p>
            <p className="text-slate-500 text-xs mt-1">
              Create a profile to override org defaults -- capacity, peak hours, cuisine -- per planning run.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 text-xs text-ember-400 hover:text-ember-300 underline underline-offset-4 transition-colors"
            >
              Create your first profile
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((p, i) => (
              <div
                key={p.id}
                className={`bg-[#0d1320] border border-white/10 rounded-xl p-5 flex items-start justify-between gap-4 transition-all hover:border-white/20 hover:-translate-y-0.5 hover:shadow-lg stagger-${Math.min(i + 2, 7)}`}
              >
                <div>
                  <p className="text-white font-medium">{p.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                    <span>Cuisine: <span className="text-slate-300">{p.cuisine}</span></span>
                    <span>Capacity: <span className="text-slate-300">{p.capacity}</span></span>
                    <span>Peak hours: <span className="text-slate-300">{p.peak_hours}</span></span>
                    <span>Timezone: <span className="text-slate-300">{p.timezone}</span></span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1.5">ID: {p.id}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(p)}
                    className="text-xs text-slate-300 border border-white/10 hover:border-white/20 hover:bg-white/5 rounded-md px-2.5 py-1.5 transition-colors"
                  >Edit</button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-xs text-rose-400 border border-rose-500/20 hover:border-rose-500/40 hover:bg-rose-500/5 rounded-md px-2.5 py-1.5 transition-colors"
                  >Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {form && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="bg-[#0d1320] border border-white/10 rounded-xl w-full max-w-md p-6" style={{ animation: "modalIn 0.2s ease both" }}>
              <h2 className="text-white font-semibold mb-5">{form.id ? "Edit Profile" : "New Profile"}</h2>
              <form onSubmit={handleSave} className="space-y-4">
                {(["name", "cuisine", "peak_hours", "timezone"] as const).map(key => (
                  <div key={key}>
                    <label className="block text-sm text-slate-400 mb-1.5 capitalize">{key.replace("_", " ")}</label>
                    <input
                      type="text"
                      value={form[key] as string}
                      onChange={e => handleField(key, e.target.value)}
                      required={key === "name"}
                      className={INPUT_CLS}
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={e => handleField("capacity", e.target.value)}
                    className={INPUT_CLS}
                  />
                </div>

                {formError && (
                  <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{formError}</div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-ember-600 hover:bg-ember-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2 text-sm transition-colors"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex-1 border border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-200 rounded-lg py-2 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
