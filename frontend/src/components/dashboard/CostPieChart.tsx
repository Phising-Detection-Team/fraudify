"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { ModelCost } from "@/types";

interface CostPieChartProps {
  data: ModelCost[];
}

const COLORS = {
  "gpt-4o": "hsl(var(--accent-cyan))",
  "claude-sonnet-4": "hsl(var(--accent-purple))",
  "gemini-1.5-pro": "hsl(var(--accent-red))",
};

export function CostPieChart({ data }: CostPieChartProps) {
  const chartData = data.map(d => ({
    name: d.model,
    value: d.cost,
  }));

  const totalCost = data.reduce((acc, curr) => acc + curr.cost, 0);

  return (
    <div className="glass-panel p-6 rounded-xl flex flex-col h-full">
      <h3 className="text-lg font-semibold mb-4">API Cost Breakdown</h3>
      
      <div className="flex-1 min-h-[250px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[entry.name as keyof typeof COLORS] || "hsl(var(--muted-foreground))"} 
                  className="hover:opacity-80 transition-all cursor-pointer"
                />
              ))}
            </Pie>
            <RechartsTooltip 
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cost"]}
              contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem" }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col mt-4">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-widest">Total</span>
          <span className="text-2xl font-bold">${totalCost.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-6 border-t border-border/50 pt-4">
        <table className="w-full text-xs text-left">
          <thead className="text-muted-foreground">
            <tr>
              <th className="pb-2 font-medium">Model</th>
              <th className="pb-2 font-medium text-right">Calls</th>
              <th className="pb-2 font-medium text-right">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {data.map((item) => (
              <tr key={item.model} className="hover:bg-muted/20">
                <td className="py-2.5 flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: COLORS[item.model as keyof typeof COLORS] || "gray" }}
                  />
                  {item.model}
                </td>
                <td className="py-2.5 text-right tabular-nums">{item.calls.toLocaleString()}</td>
                <td className="py-2.5 text-right font-medium tabular-nums">${item.cost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
