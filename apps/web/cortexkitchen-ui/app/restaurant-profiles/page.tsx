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

export default function RestaurantProfilesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [profiles, setProfiles] = useState<RestaurantProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state — null means "closed", a profile means "editing", EMPTY_FORM means "creating"
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

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setFormError(null);
  }

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
      if (id) {
        await updateRestaurantProfile(id, body);
      } else {
        await createRestaurantProfile(body);
      }
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
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <p className="text-neutral-500 text-sm">Loading profiles…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Restaurant Profiles</h1>
            <p className="text-neutral-400 text-sm mt-1">Named profiles override org-level capacity and peak hours for a planning run.</p>
          </div>
          <button
            onClick={openCreate}
            className="bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + New Profile
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>
        )}

        {profiles.length === 0 ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 text-center">
            <p className="text-neutral-400 text-sm">No profiles yet. Create one to override org defaults per planning run.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map(p => (
              <div key={p.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-white font-medium">{p.name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-neutral-400">
                    <span>Cuisine: <span className="text-neutral-300">{p.cuisine}</span></span>
                    <span>Capacity: <span className="text-neutral-300">{p.capacity}</span></span>
                    <span>Peak hours: <span className="text-neutral-300">{p.peak_hours}</span></span>
                    <span>Timezone: <span className="text-neutral-300">{p.timezone}</span></span>
                  </div>
                  <p className="text-xs text-neutral-600 mt-1.5">ID: {p.id}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(p)}
                    className="text-xs text-neutral-300 border border-neutral-700 hover:border-neutral-500 rounded-md px-2.5 py-1.5 transition-colors"
                  >Edit</button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-xs text-red-400 border border-red-400/30 hover:border-red-400/60 rounded-md px-2.5 py-1.5 transition-colors"
                  >Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Form modal */}
        {form && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-md p-6">
              <h2 className="text-white font-semibold mb-5">{form.id ? "Edit Profile" : "New Profile"}</h2>
              <form onSubmit={handleSave} className="space-y-4">
                {(["name", "cuisine", "peak_hours", "timezone"] as const).map(key => (
                  <div key={key}>
                    <label className="block text-sm text-neutral-300 mb-1.5 capitalize">{key.replace("_", " ")}</label>
                    <input
                      type="text"
                      value={form[key] as string}
                      onChange={e => handleField(key, e.target.value)}
                      required={key === "name"}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-sm text-neutral-300 mb-1.5">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={e => handleField("capacity", e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
                  />
                </div>

                {formError && (
                  <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{formError}</div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg py-2 text-sm transition-colors"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex-1 border border-neutral-700 hover:border-neutral-500 text-neutral-300 rounded-lg py-2 text-sm transition-colors"
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
