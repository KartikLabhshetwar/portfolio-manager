export type Stock = {
  id: number;
  name: string;
  quantity: number;
  buyPrice: number;
  createdAt: string | Date;
};

export function calculatePortfolioMetrics(stocks: Stock[]) {
  const totalValue = stocks.reduce((sum, s) => sum + s.quantity * s.buyPrice, 0);
  const totalQuantity = stocks.reduce((sum, s) => sum + s.quantity, 0);
  const avgBuyPrice = totalQuantity === 0 ? 0 : totalValue / totalQuantity;
  return { totalValue, avgBuyPrice, totalQuantity };
}


