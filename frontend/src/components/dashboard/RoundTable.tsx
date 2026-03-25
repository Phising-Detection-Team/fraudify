"use client";

import { Round } from "@/types";
import Link from "next/link";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { usePathname } from "next/navigation";

interface RoundTableProps {
  rounds: Round[];
}

export function RoundTable({ rounds }: RoundTableProps) {
  const pathname = usePathname();
  // TODO(AUTH): Replace with actual user role check 
  const isAdmin = pathname.includes('/dashboard/admin');
  const basePath = isAdmin ? "/dashboard/admin/rounds" : "/dashboard/user/rounds";

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="p-6 border-b border-border/50 flex justify-between items-center bg-card/30">
        <h3 className="text-lg font-semibold">Recent Detection Rounds</h3>
        <Link href={basePath} className="text-sm text-accent-cyan hover:underline hover:text-accent-cyan/80 transition-colors">
          View All
        </Link>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-background/50 border-b border-border/50">
            <tr>
              <th className="px-6 py-4 font-medium">Round ID</th>
              <th className="px-6 py-4 font-medium">Date</th>
              <th className="px-6 py-4 font-medium">Total Scanned</th>
              <th className="px-6 py-4 font-medium">Detection Rate</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rounds.map((round) => (
              <tr key={round.id} className="hover:bg-muted/30 transition-colors group">
                <td className="px-6 py-4 font-mono font-medium">{round.id.toUpperCase()}</td>
                <td className="px-6 py-4 text-muted-foreground">
                  {new Date(round.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-6 py-4">{round.totalEmails} emails</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {round.detectionRate > 80 && (
                      <AlertTriangle size={14} className="text-accent-red" />
                    )}
                    <span className={round.detectionRate > 80 ? "text-accent-red font-medium" : ""}>
                      {round.detectionRate}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    round.status === 'completed' ? 'bg-accent-green/10 text-accent-green' :
                    round.status === 'in_progress' ? 'bg-accent-cyan/10 text-accent-cyan' :
                    'bg-accent-red/10 text-accent-red'
                  }`}>
                    {round.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`${basePath}/${round.id}`}
                    className="inline-flex items-center justify-center p-2 rounded-lg bg-background/50 hover:bg-accent-cyan/10 text-muted-foreground hover:text-accent-cyan transition-colors"
                  >
                    <ChevronRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
