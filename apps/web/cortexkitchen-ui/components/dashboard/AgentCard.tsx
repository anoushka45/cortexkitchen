// components/dashboard/AgentCard.tsx
// Reusable card for each domain agent output.
// Handles null output, error output, and nested recommendation dicts gracefully.

const AGENT_META: Record<string, { label: string; icon: string; accent: string }> = {
  forecast:    { label: "Demand Forecast",       icon: "📈", accent: "border-t-violet-500"  },
  reservation: { label: "Reservation Pressure",  icon: "🪑", accent: "border-t-blue-500"    },
  complaint:   { label: "Complaint Intelligence", icon: "💬", accent: "border-t-rose-500"    },
  menu:        { label: "Menu Intelligence",      icon: "🍕", accent: "border-t-orange-500"  },
  inventory:   { label: "Inventory",              icon: "📦", accent: "border-t-teal-500"    },
};

interface Props {
  agentKey: string;
  data:     Record<string, unknown> | null;
}

export default function AgentCard({ agentKey, data }: Props) {
  const meta = AGENT_META[agentKey] ?? {
    label:  agentKey,
    icon:   "🤖",
    accent: "border-t-gray-400",
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-t-4 ${meta.accent} shadow-sm flex flex-col`}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-2 border-b border-gray-100">
        <span className="text-xl">{meta.icon}</span>
        <h3 className="text-sm font-semibold text-gray-800">{meta.label}</h3>
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex-1 text-sm text-gray-700 space-y-2">
        {!data ? (
          <p className="text-gray-400 italic">No output from this agent.</p>
        ) : data.error ? (
          <p className="text-red-500">⚠ {String(data.error)}</p>
        ) : (
          <AgentDataRows data={data} />
        )}
      </div>
    </div>
  );
}

// Recursively renders key-value pairs from the agent recommendation dict.
function AgentDataRows({ data }: { data: Record<string, unknown> }) {
  return (
    <>
      {Object.entries(data).map(([key, value]) => {
        if (value === null || value === undefined) return null;

        const label = key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        // Nested object — render as a sub-section
        if (typeof value === "object" && !Array.isArray(value)) {
          return (
            <div key={key} className="mt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                {label}
              </p>
              <div className="pl-3 border-l-2 border-gray-100 space-y-1">
                <AgentDataRows data={value as Record<string, unknown>} />
              </div>
            </div>
          );
        }

        // Array — comma joined
        // Array — render each item on its own line
if (Array.isArray(value)) {
  const items = value.map((item) => {
    if (typeof item === "string") return item;
    if (typeof item === "object" && item !== null) {
      const obj = item as Record<string, unknown>;
      // Try common text keys first, then fall back to all values joined
      return (
        obj.text       ??
        obj.issue      ??
        obj.complaint  ??
        obj.summary    ??
        obj.content    ??
        obj.theme      ??
        Object.values(obj).join(" · ")
      ) as string;
    }
    return String(item);
  });

  return (
    <div key={key} className="flex flex-col gap-1">
      <span className="text-gray-400 shrink-0">{label}</span>
      <ul className="space-y-1 mt-1">
        {items.map((item, i) => (
          <li key={i} className="text-gray-800 font-medium text-xs bg-gray-50 rounded px-2 py-1">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

        // Primitive
        return (
          <Row key={key} label={label} value={String(value)} />
        );
      })}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-400 shrink-0 w-36 truncate">{label}</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  );
}