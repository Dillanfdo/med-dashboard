import { useEffect } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAnalytics } from '@/api/hooks'
import { usePermission } from '@/lib/permissions'
import { Card, QueryState } from '@/components/ui'
import type { AnalyticsPoint } from '@/types'

export function AnalyticsPage() {
  const report = useAnalytics()
  const revenue = usePermission('view_revenue', 'analytics')
  useEffect(() => { document.title = 'Analytics · Northlight' }, [])
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <p className="text-sm text-stone-600">Aggregates only. A group smaller than 5 is shown as &lt;5.</p>
      <QueryState isLoading={report.isLoading} isError={report.isError} error={report.error} onRetry={() => void report.refetch()}>
        {report.data ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Sessions per month" points={report.data.sessionsPerMonth} />
            <ChartCard title="In person and online" points={report.data.modeSplit} />
            <ChartCard title="Completed, cancelled, no-show" points={report.data.outcomes} />
            <ChartCard title="New patients per month" points={report.data.newPatientsPerMonth} />
            {revenue && report.data.sessionsPerDoctor ? <ChartCard title="Sessions per doctor" points={report.data.sessionsPerDoctor} /> : null}
            {revenue && report.data.revenuePerMonth ? <ChartCard title="Revenue per month" points={report.data.revenuePerMonth} money /> : null}
            {revenue && report.data.sourceSplit ? <ChartCard title="Website and clinic bookings" points={report.data.sourceSplit} /> : null}
            {revenue && report.data.outstanding ? (
              <Card>
                <h2 className="font-semibold">Outstanding</h2>
                <p className="mt-2 text-2xl">{report.data.outstanding.display}</p>
              </Card>
            ) : null}
            <p className="text-sm text-stone-600 lg:col-span-2">{report.data.suppressedNote}</p>
          </div>
        ) : null}
      </QueryState>
    </div>
  )
}

function ChartCard({ title, points, money }: { title: string; points: AnalyticsPoint[]; money?: boolean }) {
  const plot = points.filter((point) => point.total !== null)
  return (
    <Card>
      <h2 className="font-semibold">{title}</h2>
      {plot.length === 0 ? <p className="mt-3 text-sm text-stone-600">Not enough data to chart this group.</p> : (
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={plot.map((point) => ({ name: point.label, value: point.total }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#115e59" name={money ? 'Rupees' : 'Count'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <table className="mt-3 w-full text-sm">
        <tbody>
          {points.map((point) => (
            <tr key={point.label}><td className="py-1">{point.label}</td><td className="py-1 text-right">{point.display}</td></tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
