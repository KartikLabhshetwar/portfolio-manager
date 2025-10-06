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
  const [sharePrefs, setSharePrefs] = useState(loadSharePreferences());
  const [calcPrefs, setCalcPrefs] = useState(loadCalculationPreferences());
  const [snapshot, setSnapshot] = useState(loadCalculationSnapshot());
  const [portfolios, setPortfolios] = useState<{ id: number; name: string }[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [tradeDate, setTradeDate] = useState("");
  const [maxViews, setMaxViews] = useState<string>("");

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
      body: JSON.stringify({ ...sharePrefs, portfolioId: selectedPortfolioId, maxViews: maxViews || null }),
    });
    const data = await res.json();
    if (data.link) window.open(data.link, "_blank");
  }

  useEffect(() => {
    setSharePrefs(loadSharePreferences());
    setCalcPrefs(loadCalculationPreferences());
    setSnapshot(loadCalculationSnapshot());
    fetchPortfolios();
  }, []);

  useEffect(() => {
    fetchStocks(selectedPortfolioId);
  }, [selectedPortfolioId]);

  const metrics = useMemo(() => calculatePortfolioMetrics(stocks), [stocks]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📈 Portfolio Dashboard</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="border rounded p-2"
          value={selectedPortfolioId ?? ''}
          onChange={(e) => setSelectedPortfolioId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Select Portfolio</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <Input
          placeholder="New portfolio name"
          className="w-48"
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
      <div className="flex flex-wrap gap-2 mb-4">
        <Input
          placeholder="Symbol (e.g. AAPL)"
          className="w-40"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
        />
        <Input
          placeholder="Date"
          type="date"
          className="w-48"
          value={tradeDate}
          onChange={(e) => setTradeDate(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={async () => {
            if (!symbol || !tradeDate) return;
            const res = await fetch(`/api/price?symbol=${encodeURIComponent(symbol)}&date=${encodeURIComponent(tradeDate)}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data?.close != null) setForm((f) => ({ ...f, buyPrice: String(data.close) }));
          }}
        >
          Fetch Price
        </Button>
        <Input
          placeholder="Stock Name"
          className="flex-1 min-w-[160px]"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          placeholder="Qty"
          type="number"
          className="w-28"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        />
        <Input
          placeholder="Buy Price"
          type="number"
          className="w-36"
          value={form.buyPrice}
          onChange={(e) => setForm({ ...form, buyPrice: e.target.value })}
        />
        <Button onClick={addStock}>Add</Button>
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

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Qty</th>
            <th className="p-2 text-left">Buy Price</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((s) => (
            <tr key={s.id} className="border-b">
              <td className="p-2">{s.name}</td>
              <td className="p-2">{s.quantity}</td>
              <td className="p-2">{s.buyPrice}</td>
              <td className="p-2">
                <Button variant="destructive" onClick={() => deleteStock(s.id)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-2 mt-4 flex-wrap items-end">
        <Button onClick={generateReport} variant="default">Generate Report</Button>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Currency (e.g. ₹ $ €)"
            className="w-40"
            value={calcPrefs.currencySymbol}
            onChange={(e) => {
              const next = { ...calcPrefs, currencySymbol: e.target.value };
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


