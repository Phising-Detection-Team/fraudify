"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { useMemo } from "react";
import { type CostBreakdownItem, type CostBreakdown } from "@/lib/admin-api";
import type { ModelCost } from "@/types";

// Ordered palette — assigned by index, not hardcoded to model name
const PALETTE = [
  "hsl(var(--accent-cyan))",
  "hsl(var(--accent-purple))",
  "hsl(var(--accent-red))",
  "hsl(var(--accent-green))",
  "#f59e0b",
  "#8b5cf6",
];

function getColor(index: number) {
  return PALETTE[index % PALETTE.length];
}

function shortLabel(item: CostBreakdownItem) {
  // Show just the model part after the last "/" if present
  const model = item.model_name.includes("/")
    ? item.model_name.split("/").pop()!
    : item.model_name;
  return model;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: CostBreakdownItem & { color: string } }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold mb-1" style={{ color: d.color }}>{d.model_name}</p>
      <p className="text-muted-foreground capitalize">{d.agent_type}</p>
      <p className="mt-1">${d.cost.toFixed(6)} <span className="text-muted-foreground">cost</span></p>
      <p>{d.calls.toLocaleString()} <span className="text-muted-foreground">calls</span></p>
      <p>{d.tokens.toLocaleString()} <span className="text-muted-foreground">tokens</span></p>
    </div>
  );
}

interface Props {
  /** Pass mock ModelCost[] for demo mode. */
  demoCosts?: ModelCost[];
  /** Pass pre-fetched CostBreakdown for real mode (from parent Promise.all). */
  serverData?: CostBreakdown;
}

export function CostPieChart({ demoCosts, serverData }: Props) {
  const { items, total } = useMemo(() => {
    if (serverData) {
      return serverData;
    }
    // Demo mode: convert mock ModelCost[] into CostBreakdownItem shape
    const mockCosts = demoCosts ?? [];
    const merged = mockCosts.reduce<Record<string, CostBreakdownItem>>(
      (acc, mc) => {
        const key = mc.model;
        if (!acc[key]) {
          acc[key] = {
            agent_type: mc.model.includes("claude") ? "detector" : "generator",
            model_name: mc.model,
            calls: 0,
            tokens: 0,
            cost: 0,
          };
        }
        acc[key].calls += mc.calls;
        acc[key].tokens += mc.inputTokens + mc.outputTokens;
        acc[key].cost += mc.cost;
        return acc;
      },
      {}
    );
    const arr = Object.values(merged);
    return { items: arr, total: arr.reduce((s, i) => s + i.cost, 0) };
  }, [demoCosts, serverData]);

  const chartData = items.map((item, i) => ({
    ...item,
    name: shortLabel(item),
    value: item.cost,
    color: getColor(i),
  }));

  const hasData = chartData.length > 0 && total > 0;

  return (
    <div className="glass-panel p-6 rounded-xl flex flex-col h-full">
      <h3 className="text-lg font-semibold mb-4">API Cost Breakdown</h3>

      <>
        {/* Pie chart */}
        <div className="relative" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={hasData ? chartData : [{ name: "No data", value: 1 }]}
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={88}
                paddingAngle={hasData ? 4 : 0}
                dataKey="value"
                stroke="none"
                isAnimationActive={false}
              >
                  {hasData
                    ? chartData.map((entry, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={entry.color}
                          className="hover:opacity-80 transition-opacity cursor-pointer"
                        />
                      ))
                    : [
                        <Cell
                          key="empty"
                          fill="hsl(var(--muted-foreground) / 0.15)"
                        />,
                      ]}
                </Pie>
                {hasData && (
                  <RechartsTooltip content={<CustomTooltip />} />
                )}
              </PieChart>
            </ResponsiveContainer>

            {/* Centre label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">
                Total
              </span>
              <span className="text-2xl font-bold mt-0.5">
                ${total.toFixed(total < 0.01 ? 6 : 4)}
              </span>
            </div>
          </div>

          {/* Legend / breakdown table */}
          <div className="mt-4 border-t border-border/50 pt-4 flex-1">
            {hasData ? (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pb-2 font-medium">Model</th>
                    <th className="pb-2 font-medium text-center">Type</th>
                    <th className="pb-2 font-medium text-right">Calls</th>
                    <th className="pb-2 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {chartData.map((item, i) => (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-mono truncate max-w-[120px]" title={item.model_name}>
                            {shortLabel(item)}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            item.agent_type === "generator"
                              ? "bg-accent-cyan/10 text-accent-cyan"
                              : "bg-accent-purple/10 text-accent-purple"
                          }`}
                        >
                          {item.agent_type}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums">
                        {item.calls.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right font-medium tabular-nums">
                        ${item.cost.toFixed(item.cost < 0.01 ? 6 : 4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">
                No API calls recorded yet. Run a round to see cost data.
              </p>
            )}
          </div>
        </>
    </div>
  );
}
