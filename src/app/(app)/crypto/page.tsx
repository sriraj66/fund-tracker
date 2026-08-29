"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/context/AuthContext";
import { formatINR, formatDate, formatNumber } from "@/lib/utils";
import StatCard from "@/components/StatCard";
import { Bitcoin, TrendingUp, TrendingDown, Plus } from "lucide-react";
import CryptoAddModal from "./CryptoAddModal";
import CryptoAddHoldingModal from "./CryptoAddHoldingModal";
import CryptoMonthlyStats from "./CryptoMonthlyStats";
import ImportButton from "@/components/ImportButton";
import DeleteButton from "@/components/DeleteButton";
import { deleteDoc, doc } from "firebase/firestore";
import { Trash2, Loader2 } from "lucide-react";

interface CryptoTx { id: string; market: string; coin: string; trade_type: string; price?: number; volume?: number; total_inr?: number; tds_amount?: number; fee_amount?: number; transaction_date: string; }
interface CryptoHolding { id: string; coin_name: string; invested_amount: number; avg_buy_price: number; quantity: number; record_date: string; }

// Extract coin symbol from market pair (e.g. BTCINR → BTC, ETHUSDT → ETH)
function extractCoin(market: string): string {
  if (!market) return "";
  const u = market.toUpperCase().trim();
  for (const q of ["INR", "USDT", "USDC", "BTC", "ETH", "BNB"]) {
    if (u.endsWith(q) && u.length > q.length) return u.slice(0, u.length - q.length);
  }
  return u;
}

// Resolve the best display name for a coin
function resolveCoin(coin: string, market: string): string {
  if (coin && coin.trim()) return coin.trim().toUpperCase();
  return extractCoin(market);
}

const TX_PAGE_SIZE = 8;

function PaginationBar({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * TX_PAGE_SIZE + 1;
  const to = Math.min(page * TX_PAGE_SIZE, total);
  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2))
    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);
  return (
    <div className="px-4 py-3 md:px-6 border-t border-gray-800/60 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-1 flex-wrap justify-center order-1 sm:order-2">
        <button onClick={() => onPage(1)} disabled={page === 1} className="px-2 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">«</button>
        <button onClick={() => onPage(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
        {pageNums.map((item, idx) =>
          item === "..." ? (
            <span key={`e${idx}`} className="hidden sm:inline px-2 py-1 text-xs text-gray-600">…</span>
          ) : (
            <button key={item} onClick={() => onPage(item as number)}
              className={`hidden sm:inline-flex px-3 py-1.5 rounded text-xs font-medium transition-colors ${page === item ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
              {item}
            </button>
          )
        )}
        <span className="sm:hidden text-xs text-gray-500 px-2">{page} / {totalPages}</span>
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
        <button onClick={() => onPage(totalPages)} disabled={page === totalPages} className="px-2 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">»</button>
      </div>
      <p className="text-xs text-gray-500 order-2 sm:order-1 text-center sm:text-left">
        Showing <span className="text-gray-300 font-medium">{from}–{to}</span> of{" "}
        <span className="text-gray-300 font-medium">{total}</span> trades
      </p>
    </div>
  );
}

const HOLDINGS_PAGE_SIZE = 5;
const IMP_PAGE_SIZE = 5;

export default function CryptoPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CryptoTx[]>([]);
  const [manualHoldings, setManualHoldings] = useState<CryptoHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);
  const [holdingsPage, setHoldingsPage] = useState(1);
  const [impPage, setImpPage] = useState(1);
  const [deletingHolding, setDeletingHolding] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [txSnap, holdSnap] = await Promise.all([
        getDocs(query(collection(db, "users", user.uid, "crypto_transactions"), orderBy("transaction_date", "desc"))),
        getDocs(query(collection(db, "users", user.uid, "crypto_holdings"), orderBy("record_date", "desc"))),
      ]);
      setRows(txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CryptoTx)));
      setManualHoldings(holdSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CryptoHolding)));
      setTxPage(1);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleDeleteHolding = async (id: string) => {
    if (!user) return;
    if (!window.confirm("Delete this holding? This cannot be undone.")) return;
    setDeletingHolding(id);
    try {
      await deleteDoc(doc(db, "users", user.uid, "crypto_holdings", id));
      setManualHoldings(prev => prev.filter(h => h.id !== id));
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setDeletingHolding(null); }
  };

  const totalBought = rows.filter((t) => t.trade_type === "BUY").reduce((s, t) => s + Number(t.total_inr ?? 0), 0);
  const totalSold = rows.filter((t) => t.trade_type === "SELL").reduce((s, t) => s + Number(t.total_inr ?? 0), 0);
  const holdingsInvested = manualHoldings.reduce((s, h) => s + Number(h.invested_amount), 0);
  const netInvested = totalBought - totalSold + holdingsInvested;
  const totalBrokerage = rows.reduce((s, t) => s + Number(t.fee_amount ?? 0), 0);

  const txTotalPages = Math.max(1, Math.ceil(rows.length / TX_PAGE_SIZE));
  const paginatedRows = useMemo(() => rows.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE), [rows, txPage]);

  // Build coin holdings from transactions — use resolved coin name as key
  const coinMap = new Map<string, { qty: number; invested: number; count: number }>();
  for (const t of rows) {
    const coinKey = resolveCoin(t.coin, t.market);
    if (!coinKey) continue;
    const ex = coinMap.get(coinKey) ?? { qty: 0, invested: 0, count: 0 };
    if (t.trade_type === "BUY") { ex.qty += Number(t.volume ?? 0); ex.invested += Number(t.total_inr ?? 0); }
    else { ex.qty -= Number(t.volume ?? 0); ex.invested -= Number(t.total_inr ?? 0); }
    ex.count += 1;
    coinMap.set(coinKey, ex);
  }
  const txHoldings = Array.from(coinMap.entries()).map(([coin, d]) => ({ coin, ...d })).filter((h) => h.qty > 0.000001);

  // Merge manual holdings into the same coin map for unified display
  const mergedMap = new Map<string, { qty: number; invested: number; fromTx: boolean; fromManual: boolean }>();
  for (const h of txHoldings) {
    mergedMap.set(h.coin, { qty: h.qty, invested: h.invested, fromTx: true, fromManual: false });
  }
  for (const h of manualHoldings) {
    const coin = h.coin_name.trim().toUpperCase();
    const ex = mergedMap.get(coin) ?? { qty: 0, invested: 0, fromTx: false, fromManual: false };
    ex.qty += Number(h.quantity);
    ex.invested += Number(h.invested_amount);
    ex.fromManual = true;
    mergedMap.set(coin, ex);
  }
  const allHoldings = Array.from(mergedMap.entries())
    .map(([coin, d]) => ({ coin, ...d, avgPrice: d.qty > 0 ? d.invested / d.qty : 0 }))
    .filter((h) => h.qty > 0.000001)
    .sort((a, b) => b.invested - a.invested);

  // Group manual holdings by coin for accordion display
  const holdingsByCoin = new Map<string, { coin: string; total: number; records: CryptoHolding[] }>();
  for (const h of manualHoldings) {
    const coin = h.coin_name.trim().toUpperCase();
    const ex = holdingsByCoin.get(coin) ?? { coin, total: 0, records: [] };
    ex.total += Number(h.invested_amount);
    ex.records.push(h);
    holdingsByCoin.set(coin, ex);
  }
  const holdingGroups = Array.from(holdingsByCoin.values()).sort((a, b) => b.total - a.total);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1 className="text-xl md:text-2xl font-bold text-white">Crypto</h1><p className="text-gray-400 text-sm mt-1">CoinSwitch spot trades (INR)</p></div>
        <div className="page-header-actions">
          <ImportButton endpoint="/api/import/crypto" accept=".xlsx,.xls" label="Import Transactions" hint="CoinSwitch Transaction Statement XLSX" onSuccess={fetchData} />
          <ImportButton endpoint="/api/import/holdings/crypto" accept=".xlsx,.xls" label="Import Holdings" hint="CoinSwitch Trade Report (Balances VDA)" onSuccess={fetchData} />
          <CryptoAddHoldingModal onAdded={fetchData} />
          <CryptoAddModal onAdded={fetchData} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Net Invested" value={formatINR(netInvested)} subtitle={`Tx net${holdingsInvested > 0 ? ` + ${manualHoldings.length} holding${manualHoldings.length !== 1 ? "s" : ""}` : ""}`} icon={Bitcoin} iconColor="text-orange-400" iconBg="bg-orange-500/10" />
        <StatCard title="Total Bought" value={formatINR(totalBought)} subtitle={`${rows.filter((t) => t.trade_type === "BUY").length} buys`} icon={TrendingUp} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <StatCard title="Total Sold" value={formatINR(totalSold)} subtitle={`${rows.filter((t) => t.trade_type === "SELL").length} sells`} icon={TrendingDown} iconColor="text-red-400" iconBg="bg-red-500/10" />
        <StatCard title="Brokerage Paid" value={formatINR(totalBrokerage)} subtitle={`${rows.length} trades`} icon={Bitcoin} iconColor="text-yellow-400" iconBg="bg-yellow-500/10" />
      </div>

      {rows.length > 0 && <CryptoMonthlyStats transactions={rows} onDeleted={fetchData} />}

      {/* Unified Coin Holdings — transactions + manual holdings merged */}
      {allHoldings.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Coin Holdings</h2>
            <p className="text-xs text-gray-500">Transactions + manual holdings combined</p>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Coin</th>
                  <th className="text-right">Balance</th>
                  <th className="text-right">Net Invested (INR)</th>
                  <th className="text-right">Avg Buy Price</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {allHoldings.slice((holdingsPage - 1) * HOLDINGS_PAGE_SIZE, holdingsPage * HOLDINGS_PAGE_SIZE).map((h) => (
                  <tr key={h.coin}>
                    <td><span className="font-mono font-semibold text-orange-400">{h.coin}</span></td>
                    <td className="text-right text-gray-300">{formatNumber(h.qty, 8)}</td>
                    <td className="text-right font-medium text-gray-200">{formatINR(h.invested)}</td>
                    <td className="text-right text-gray-300">{h.avgPrice > 0 ? formatINR(h.avgPrice) : "—"}</td>
                    <td>
                      <div className="flex items-center gap-1 flex-wrap">
                        {h.fromTx && <span className="px-1.5 py-0.5 rounded text-xs bg-orange-500/10 text-orange-400">Trades</span>}
                        {h.fromManual && <span className="px-1.5 py-0.5 rounded text-xs bg-sky-500/10 text-sky-400">Holdings</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Coin Holdings pagination */}
          {allHoldings.length > HOLDINGS_PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 md:px-6 border-t border-gray-800/60">
              <p className="text-xs text-gray-500">
                Showing <span className="text-gray-300 font-medium">{(holdingsPage - 1) * HOLDINGS_PAGE_SIZE + 1}–{Math.min(holdingsPage * HOLDINGS_PAGE_SIZE, allHoldings.length)}</span> of <span className="text-gray-300 font-medium">{allHoldings.length}</span> coins
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setHoldingsPage(p => Math.max(1, p - 1))} disabled={holdingsPage === 1} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
                {Array.from({ length: Math.ceil(allHoldings.length / HOLDINGS_PAGE_SIZE) }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setHoldingsPage(p)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${holdingsPage === p ? "bg-orange-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>{p}</button>
                ))}
                <button onClick={() => setHoldingsPage(p => Math.min(Math.ceil(allHoldings.length / HOLDINGS_PAGE_SIZE), p + 1))} disabled={holdingsPage === Math.ceil(allHoldings.length / HOLDINGS_PAGE_SIZE)} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Imported Holdings — grouped by coin, expandable accordion */}
      {holdingGroups.length > 0 && (
        <ImportedHoldingsAccordion
          holdingGroups={holdingGroups}
          holdingsInvested={holdingsInvested}
          deletingHolding={deletingHolding}
          onDelete={handleDeleteHolding}
          page={impPage}
          onPage={setImpPage}
          pageSize={IMP_PAGE_SIZE}
        />
      )}

      {/* Trade History */}
      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60"><h2 className="text-base font-semibold text-white">Trade History</h2></div>
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-3"><Plus className="w-6 h-6 text-orange-400" /></div>
            <p className="text-gray-400 text-sm font-medium">No crypto trades yet</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Coin</th><th>Type</th>
                    <th className="text-right col-tablet-hidden">Volume</th><th className="text-right col-tablet-hidden">Price (INR)</th>
                    <th className="text-right">Total (INR)</th><th className="text-right col-mobile-hidden">Brokerage</th>
                    <th className="col-mobile-hidden">Date</th><th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((t) => {
                    const displayCoin = resolveCoin(t.coin, t.market);
                    return (
                      <tr key={t.id}>
                        <td>
                          <div className="font-mono font-semibold text-orange-400">{displayCoin || "—"}</div>
                          <div className="text-xs text-gray-500 col-mobile-hidden">{t.market}</div>
                        </td>
                        <td><span className={t.trade_type === "BUY" ? "badge-buy" : "badge-sell"}>{t.trade_type}</span></td>
                        <td className="text-right text-gray-300 col-tablet-hidden">{formatNumber(Number(t.volume ?? 0), 8)}</td>
                        <td className="text-right text-gray-300 col-tablet-hidden">{t.price ? formatINR(Number(t.price)) : "—"}</td>
                        <td className="text-right font-medium text-gray-200">{t.total_inr ? formatINR(Number(t.total_inr)) : "—"}</td>
                        <td className="text-right text-yellow-400 text-xs col-mobile-hidden">{t.fee_amount ? formatINR(Number(t.fee_amount)) : "—"}</td>
                        <td className="text-gray-400 text-xs col-mobile-hidden">{formatDate(t.transaction_date)}</td>
                        <td className="text-center"><DeleteButton id={t.id} endpoint="/api/delete/crypto" itemName={displayCoin} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar page={txPage} totalPages={txTotalPages} total={rows.length} onPage={setTxPage} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Imported Holdings Accordion ──────────────────────────────────────────
function ImportedHoldingsAccordion({
  holdingGroups, holdingsInvested, deletingHolding, onDelete, page, onPage, pageSize,
}: {
  holdingGroups: { coin: string; total: number; records: CryptoHolding[] }[];
  holdingsInvested: number;
  deletingHolding: string | null;
  onDelete: (id: string) => void;
  page: number;
  onPage: (p: number) => void;
  pageSize: number;
}) {
  const [expandedCoin, setExpandedCoin] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(holdingGroups.length / pageSize));
  const pagedGroups = holdingGroups.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-800/60 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Imported Holdings</h2>
          <p className="text-gray-500 text-xs mt-0.5">Manually added coin positions — click to expand</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Total Invested</p>
          <p className="text-base font-bold text-orange-400">{formatINR(holdingsInvested)}</p>
        </div>
      </div>

      <div className="divide-y divide-gray-800/60">
        {pagedGroups.map((group) => {
          const isOpen = expandedCoin === group.coin;
          return (
            <div key={group.coin}>
              {/* Coin header row */}
              <button
                onClick={() => setExpandedCoin(isOpen ? null : group.coin)}
                className="w-full flex items-center justify-between px-4 py-4 md:px-6 hover:bg-gray-800/30 transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${isOpen ? "text-orange-400" : "text-gray-500 group-hover:text-gray-300"}`}>
                    {isOpen ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    )}
                  </div>
                  <span className="font-mono font-semibold text-orange-400 text-sm">{group.coin}</span>
                  <span className="text-xs text-gray-500">{group.records.length} record{group.records.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Invested</div>
                  <div className="font-semibold text-orange-400 text-sm">{formatINR(group.total)}</div>
                </div>
              </button>

              {/* Expanded holding records */}
              {isOpen && (
                <div className="bg-gray-900/40 border-t border-gray-800/40 overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Coin</th>
                        <th className="text-right">Quantity</th>
                        <th className="text-right">Avg Buy Price</th>
                        <th className="text-right">Invested (₹)</th>
                        <th>Record Date</th>
                        <th className="text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.records.map((h) => (
                        <tr key={h.id}>
                          <td><span className="font-mono font-semibold text-orange-400">{h.coin_name}</span></td>
                          <td className="text-right text-gray-300">{formatNumber(Number(h.quantity), 8)}</td>
                          <td className="text-right text-gray-300">{formatINR(Number(h.avg_buy_price))}</td>
                          <td className="text-right font-semibold text-orange-400">{formatINR(Number(h.invested_amount))}</td>
                          <td className="text-gray-400 text-xs">{formatDate(h.record_date)}</td>
                          <td className="text-center">
                            <button
                              onClick={() => onDelete(h.id)}
                              disabled={deletingHolding === h.id}
                              className="inline-flex items-center justify-center w-7 h-7 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                              title="Delete holding"
                            >
                              {deletingHolding === h.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {/* Imported Holdings pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 md:px-6 border-t border-gray-800/60 bg-gray-900/30">
            <p className="text-xs text-gray-500">
              Coins <span className="text-gray-300 font-medium">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, holdingGroups.length)}</span> of <span className="text-gray-300 font-medium">{holdingGroups.length}</span>
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => { onPage(Math.max(1, page - 1)); setExpandedCoin(null); }} disabled={page === 1} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">‹ Prev</button>
              <span className="text-xs text-gray-500">{page} / {totalPages}</span>
              <button onClick={() => { onPage(Math.min(totalPages, page + 1)); setExpandedCoin(null); }} disabled={page === totalPages} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Next ›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
