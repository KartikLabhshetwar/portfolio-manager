"use client";

import { useEffect, useMemo, useState } from "react";
import { calculatePortfolioMetrics, type Stock } from "@/lib/calculations";
import { loadSharePreferences, saveSharePreferences } from "@/lib/config";
import {
  loadCalculationPreferences,
  saveCalculationPreferences,
  loadCalculationSnapshot,
  saveCalculationSnapshot,
} from "@/lib/calc-config";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [form, setForm] = useState({ name: "", quantity: "", buyPrice: "" });
  // Initialize with SSR-stable defaults; hydrate from localStorage after mount to avoid mismatches
  const [sharePrefs, setSharePrefs] = useState({ password: "", expireInMinutes: null as number | null });
  const [calcPrefs, setCalcPrefs] = useState({ currencySymbol: "$", expectedAnnualReturnPct: 8 });
  const [snapshot, setSnapshot] = useState<ReturnType<typeof loadCalculationSnapshot>>(null);
  const [portfolios, setPortfolios] = useState<{ id: number; name: string }[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [tradeDate, setTradeDate] = useState("");
  const [maxViews, setMaxViews] = useState<string>("");
  const [oneTimeView, setOneTimeView] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  async function fetchStocks(pid = selectedPortfolioId) {
    if (!pid) {
      setStocks([]);
      return;
    }
    const res = await fetch(`/api/stocks?portfolioId=${pid}`, { cache: "no-store" });
    setStocks(await res.json());
  }

  async function fetchPortfolios() {
    const res = await fetch("/api/portfolios", { cache: "no-store" });
    const data = (await res.json()) as { id: number; name: string }[];
    setPortfolios(data);
    if (!selectedPortfolioId) {
      const first = data[0]?.id ?? null;
      setSelectedPortfolioId(first);
    }
  }

  async function addStock() {
    if (!selectedPortfolioId) return;
    try {
      setIsAdding(true);
      await fetch("/api/stocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          quantity: parseFloat(form.quantity || "0"),
          buyPrice: parseFloat(form.buyPrice || "0"),
          portfolioId: selectedPortfolioId,
        }),
      });
      setForm({ name: "", quantity: "", buyPrice: "" });
      fetchStocks(selectedPortfolioId);
    } finally {
      setIsAdding(false);
    }
  }

  async function deleteStock(id: number) {
    await fetch("/api/stocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchStocks(selectedPortfolioId);
  }

  function generateReport() {
    const q = selectedPortfolioId ? `?portfolioId=${selectedPortfolioId}` : "";
    window.open(`/api/report${q}`, "_blank");
  }

  async function createShareLink() {
    saveSharePreferences(sharePrefs);
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...sharePrefs,
        portfolioId: selectedPortfolioId,
        maxViews: oneTimeView ? 1 : (maxViews ? Number(maxViews) : null),
      }),
    });
    const data = await res.json();
    if (data.link) window.open(data.link, "_blank");
  }

  useEffect(() => {
    setSharePrefs(loadSharePreferences());
    const loaded = loadCalculationPreferences();
    setCalcPrefs({ currencySymbol: loaded.currencySymbol, expectedAnnualReturnPct: loaded.expectedAnnualReturnPct ?? 8 });
    setSnapshot(loadCalculationSnapshot());
    fetchPortfolios();
  }, []);

  useEffect(() => {
    fetchStocks(selectedPortfolioId);
  }, [selectedPortfolioId]);

  useEffect(() => {
    async function maybeFetch() {
      if (!symbol || !tradeDate) return;
      const res = await fetch(`/api/price?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(tradeDate)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.close != null) setForm((f) => ({ ...f, buyPrice: String(data.close) }));
    }
    maybeFetch();
  }, [symbol, tradeDate]);

  const metrics = useMemo(() => calculatePortfolioMetrics(stocks), [stocks]);

  const canAdd =
    !!selectedPortfolioId && form.name.trim() && Number(form.quantity) > 0 && Number(form.buyPrice) > 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl font-bold">📈 Portfolio Dashboard</h1>
        {selectedPortfolioId && (
          <span className="text-sm text-gray-600">Active portfolio: {portfolios.find(p => p.id === selectedPortfolioId)?.name}</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div>
          <div className="text-xs text-gray-600 mb-1">Portfolio</div>
          <select
            className="border rounded p-2 w-full"
            value={selectedPortfolioId ?? ''}
            onChange={(e) => setSelectedPortfolioId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select Portfolio</option>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">New portfolio</div>
          <div className="flex gap-2">
            <Input
              placeholder="New portfolio name"
              className="flex-1"
              value={newPortfolioName}
              onChange={(e) => setNewPortfolioName(e.target.value)}
            />
            <Button
              onClick={async () => {
                const name = newPortfolioName.trim();
                if (!name) return;
                const res = await fetch('/api/portfolios', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name }),
                });
                const created = await res.json();
                setNewPortfolioName('');
                await fetchPortfolios();
                setSelectedPortfolioId(created.id);
              }}
            >
              New Portfolio
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4 items-end">
        <div className="md:col-span-2">
          <div className="text-xs text-gray-600 mb-1">Stock name</div>
          <Input
            placeholder="e.g. Apple Inc."
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">Symbol</div>
          <Input
            placeholder="AAPL"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          />
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">Date</div>
          <Input
            type="date"
            value={tradeDate}
            onChange={(e) => setTradeDate(e.target.value)}
          />
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">Fetch price</div>
          <Button
            className="w-full"
            variant="outline"
            disabled={isFetchingPrice}
            onClick={async () => {
              if (!symbol || !tradeDate) return;
              try {
                setIsFetchingPrice(true);
                const res = await fetch(`/api/price?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(tradeDate)}`);
                if (!res.ok) return;
                const data = await res.json();
                if (data?.close != null) setForm((f) => ({ ...f, buyPrice: String(data.close) }));
              } finally {
                setIsFetchingPrice(false);
              }
            }}
          >
            {isFetchingPrice ? "Fetching..." : "Fetch Price"}
          </Button>
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">Quantity</div>
          <Input
            placeholder="0"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">Buy price</div>
          <Input
            placeholder="0.00"
            type="number"
            value={form.buyPrice}
            onChange={(e) => setForm({ ...form, buyPrice: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <div className="text-xs text-gray-600 mb-1">Total cost</div>
          <Input
            type="number"
            value={(() => {
              const q = parseFloat(form.quantity || "0");
              const p = parseFloat(form.buyPrice || "0");
              const total = Number.isFinite(q) && Number.isFinite(p) ? q * p : 0;
              return total ? String(total.toFixed(2)) : "";
            })()}
            readOnly
          />
        </div>
        <div className="md:col-span-1">
          <div className="text-xs text-gray-600 mb-1">&nbsp;</div>
          <Button className="w-full" onClick={addStock} disabled={!canAdd || isAdding} variant={canAdd ? "default" : "outline"}>
            {isAdding ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">Portfolio Summary</h2>
        <p>
          Total Value: {calcPrefs.currencySymbol}
          {metrics.totalValue.toFixed(2)}
        </p>
        <p>
          Average Buy Price: {calcPrefs.currencySymbol}
          {metrics.avgBuyPrice.toFixed(2)}
        </p>
        <p>Total Quantity: {metrics.totalQuantity}</p>
        {snapshot && (
          <div className="mt-2 text-sm text-gray-600">
            <div>Saved Snapshot ({new Date(snapshot.savedAt).toLocaleString()}):</div>
            <div>
              Total: {calcPrefs.currencySymbol}
              {snapshot.totalValue.toFixed(2)} | Avg: {calcPrefs.currencySymbol}
              {snapshot.avgBuyPrice.toFixed(2)} | Qty: {snapshot.totalQuantity}
            </div>
          </div>
        )}
      </div>

      <table className="w-full border rounded-md overflow-hidden">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Qty</th>
            <th className="p-2 text-left">Buy Price</th>
            <th className="p-2 text-left">Value</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {stocks.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-4 text-center text-gray-500">No stocks yet. Add your first position above.</td>
            </tr>
          ) : (
            stocks.map((s) => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="p-2">{s.name}</td>
                <td className="p-2">{s.quantity}</td>
                <td className="p-2">{calcPrefs.currencySymbol}{s.buyPrice}</td>
                <td className="p-2">{calcPrefs.currencySymbol}{(s.quantity * s.buyPrice).toFixed(2)}</td>
                <td className="p-2">
                  <Button variant="destructive" onClick={() => deleteStock(s.id)}>Delete</Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="flex gap-2 mt-4 flex-wrap items-end">
        <Button onClick={generateReport} variant="default">Generate Report</Button>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Currency (e.g. $ $ €)"
            className="w-40"
            value={calcPrefs.currencySymbol}
            onChange={(e) => {
              const next = { ...calcPrefs, currencySymbol: e.target.value };
              setCalcPrefs(next);
              saveCalculationPreferences(next);
            }}
          />
          <Input
            placeholder="Expected annual return %"
            type="number"
            className="w-56"
            value={String(calcPrefs.expectedAnnualReturnPct ?? 8)}
            onChange={(e) => {
              const val = Number(e.target.value || 0);
              const next = { ...calcPrefs, expectedAnnualReturnPct: val };
              setCalcPrefs(next);
              saveCalculationPreferences(next);
            }}
          />
          <Button
            variant="outline"
            onClick={() => {
              const snap = {
                totalValue: metrics.totalValue,
                avgBuyPrice: metrics.avgBuyPrice,
                totalQuantity: metrics.totalQuantity,
                savedAt: new Date().toISOString(),
              };
              saveCalculationSnapshot(snap);
              setSnapshot(snap);
            }}
          >
            Save Snapshot
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Password (optional)"
            value={sharePrefs.password}
            onChange={(e) => setSharePrefs({ ...sharePrefs, password: e.target.value })}
          />
          <Input
            placeholder="Expire in minutes (optional)"
            type="number"
            value={sharePrefs.expireInMinutes ?? ""}
            onChange={(e) =>
              setSharePrefs({
                ...sharePrefs,
                expireInMinutes: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={oneTimeView}
              onChange={(e) => setOneTimeView(e.target.checked)}
            />
            One-time view
          </label>
          <Input
            placeholder="Max views (optional)"
            type="number"
            value={maxViews}
            onChange={(e) => setMaxViews(e.target.value)}
          />
          <Button onClick={createShareLink} variant="secondary">Create Share Link</Button>
        </div>
      </div>
    </div>
  );
}


