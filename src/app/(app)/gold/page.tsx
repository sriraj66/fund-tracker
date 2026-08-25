"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate, formatNumber } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import { Gem, Scale, Plus } from "lucide-react";
import GoldAddModal from "./GoldAddModal";
import DeleteButton from "@/components/DeleteButton";

interface GoldTx { id: string; purchase_date: string; price_per_gram: number; grams: number; amount: number; gold_type: string; notes?: string; }

export default function GoldPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<GoldTx[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users", user.uid, "gold_transactions"), orderBy("purchase_date", "desc")));
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GoldTx)));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user]);

  const totalAmount = rows.reduce((s, t) => s + Number(t.amount), 0);
  const totalGrams = rows.reduce((s, t) => s + Number(t.grams), 0);
  const avgPrice = totalGrams > 0 ? totalAmount / totalGrams : 0;

  const typeMap = new Map<string, { grams: number; amount: number; count: number }>();
  for (const t of rows) {
    const ex = typeMap.get(t.gold_type) ?? { grams: 0, amount: 0, count: 0 };
    ex.grams += Number(t.grams); ex.amount += Number(t.amount); ex.count += 1;
    typeMap.set(t.gold_type, ex);
  }
  const byType = Array.from(typeMap.entries()).map(([type, d]) => ({ type, ...d }));

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Gold</h1><p className="text-gray-400 text-sm mt-1">Track physical, digital &amp; sovereign gold</p></div>
        <GoldAddModal onAdded={fetchData} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Invested" value={formatINR(totalAmount)} subtitle={`${rows.length} purchases`} icon={Gem} iconColor="text-yellow-400" iconBg="bg-yellow-500/10" />
        <StatCard title="Total Weight" value={`${formatNumber(totalGrams, 4)} g`} subtitle="Grams accumulated" icon={Scale} iconColor="text-amber-400" iconBg="bg-amber-500/10" />
        <StatCard title="Avg Buy Price" value={formatINR(avgPrice)} subtitle="Per gram (weighted avg)" icon={Gem} iconColor="text-orange-400" iconBg="bg-orange-500/10" />
      </div>

      {byType.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Holdings by Type</h2></div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Gold Type</th><th className="text-right">Total Grams</th><th className="text-right">Total Invested</th><th className="text-right">Avg Price/gram</th><th className="text-right">Purchases</th></tr></thead>
              <tbody>{byType.map((b) => (<tr key={b.type}><td><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" /><span className="font-medium text-gray-200">{b.type}</span></span></td><td className="text-right text-gray-300">{formatNumber(b.grams, 4)} g</td><td className="text-right font-medium text-gray-200">{formatINR(b.amount)}</td><td className="text-right text-gray-300">{b.grams > 0 ? formatINR(b.amount / b.grams) : "—"}</td><td className="text-right text-gray-400">{b.count}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Purchase History</h2></div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center"><div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-3"><Plus className="w-6 h-6 text-yellow-400" /></div><p className="text-gray-400 text-sm font-medium">No gold purchases yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th className="text-right">Grams</th><th className="text-right">Price / gram</th><th className="text-right">Total Amount</th><th>Notes</th><th className="text-center">Action</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="text-gray-300 font-medium">{formatDate(t.purchase_date)}</td>
                    <td><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">{t.gold_type}</span></td>
                    <td className="text-right text-gray-300">{formatNumber(Number(t.grams), 4)} g</td>
                    <td className="text-right text-gray-300">{formatINR(Number(t.price_per_gram))}</td>
                    <td className="text-right font-semibold text-yellow-400">{formatINR(Number(t.amount))}</td>
                    <td className="text-gray-500 text-xs max-w-[160px] truncate">{t.notes ?? "—"}</td>
                    <td className="text-center"><DeleteButton id={t.id} endpoint="/api/delete/gold" itemName={t.gold_type} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
