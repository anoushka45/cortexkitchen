// components/dashboard/RunButton.tsx
// Triggers a Friday Rush planning run.
// Shows loading state while the orchestration pipeline runs.

"use client";

import Spinner from "@/components/ui/Spinner";

interface Props {
    onRun: () => void;
    onReset?: () => void;
    loading: boolean;
    hasData: boolean;
}

export default function RunButton({ onRun, onReset, loading, hasData }: Props) {
    return (
        <div className="flex items-center gap-3">
            <button
                onClick={() => onRun()}
                disabled={loading}
                className="
          inline-flex items-center gap-2 px-5 py-2.5
          bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300
          text-white text-sm font-semibold rounded-lg
          transition-colors shadow-sm
        "
            >
                {loading ? (
                    <>
                        <Spinner size={16} />
                        Running pipeline…
                    </>
                ) : (
                    <>
                        ⚡ Run Friday Rush
                    </>
                )}
            </button>

            {hasData && !loading && onReset && (
                <button
                    onClick={onReset}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                    Reset
                </button>
            )}
        </div>
    );
}