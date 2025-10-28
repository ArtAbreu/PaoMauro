import ReportsDashboard from "@/components/reports-dashboard";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-slate-500">
          Visualize vendas, lucro e exporte dados para análise avançada.
        </p>
      </div>
      <ReportsDashboard />
    </div>
  );
}
