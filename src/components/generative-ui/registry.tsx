import { defineRegistry } from '@json-render/react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { insightsCatalog } from '@/lib/generative-ui/catalog'
import { cn } from '@/lib/utils'

// React implementations of the insights catalog, drawn with the app's own components.
// Charts use Recharts in shades of the app blue.

const palette = ['var(--primary)', '#93c5fd', '#1e40af', '#38bdf8', '#6366f1', '#bfdbfe']
const numberFormat = new Intl.NumberFormat('fr', { maximumFractionDigits: 1 })
const compactFormat = new Intl.NumberFormat('fr', { notation: 'compact', maximumFractionDigits: 1 })
const dateFormat = new Intl.DateTimeFormat('fr', { day: 'numeric', month: 'short' })

function formatValue(value: unknown, unit?: string | null) {
  if (typeof value !== 'number') return String(value ?? '—')
  return unit ? `${numberFormat.format(value)} ${unit}` : numberFormat.format(value)
}

// ISO dates (2026-11-03) read as "3 nov." on axes and tooltips; anything else is shown as is.
function formatTick(value: unknown) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return dateFormat.format(new Date(value))
  return String(value)
}

const axis = { stroke: 'var(--muted-foreground)', fontSize: 11, tickLine: false, axisLine: false } as const
const tooltipStyle = {
  contentStyle: {
    background: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--popover-foreground)',
  },
  labelStyle: { color: 'var(--muted-foreground)', marginBottom: 4 },
  cursor: { fill: 'var(--muted)', opacity: 0.5 },
} as const

const toneClass = {
  default: '',
  blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  red: 'bg-red-500/15 text-red-700 dark:text-red-300',
}

export const { registry: insightsRegistry } = defineRegistry(insightsCatalog, {
  components: {
    Grid: ({ props, children }) => (
      <div
        className={cn(
          'grid grid-cols-1 gap-3',
          props.columns === 2 && 'sm:grid-cols-2',
          props.columns === 3 && 'sm:grid-cols-3',
          props.columns === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
        )}
      >
        {children}
      </div>
    ),

    Stack: ({ props, children }) => (
      <div className={cn('flex flex-col', props.gap === 'sm' ? 'gap-2' : props.gap === 'lg' ? 'gap-6' : 'gap-4')}>{children}</div>
    ),

    Card: ({ props, children }) => (
      <Card size="sm">
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
          {props.description && <CardDescription>{props.description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    ),

    Text: ({ props }) =>
      props.variant === 'heading' ? (
        <h3 className="text-base font-semibold tracking-tight">{props.text}</h3>
      ) : (
        <p className={cn('text-sm', props.variant === 'muted' && 'text-muted-foreground')}>{props.text}</p>
      ),

    Metric: ({ props }) => {
      const change = props.change
      const good = change == null ? null : (change >= 0) === (props.higherIsBetter ?? true)
      return (
        <div className="flex flex-col gap-1 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
          <span className="text-xs text-muted-foreground">{props.label}</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {typeof props.value === 'number' ? compactFormat.format(props.value) : props.value}
            {props.unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{props.unit}</span>}
          </span>
          {change != null && (
            <span className={cn('flex items-center gap-1 text-xs', good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
              {change >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {change >= 0 ? '+' : ''}
              {numberFormat.format(change)} %
              {props.changeLabel && <span className="text-muted-foreground">{props.changeLabel}</span>}
            </span>
          )}
        </div>
      )
    },

    LineChart: ({ props }) => {
      const Chart = props.area ? AreaChart : LineChart
      return (
        <div className="h-56 w-full">
          <ResponsiveContainer>
            <Chart data={props.data ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <defs>
                {props.series.map((serie, index) => (
                  <linearGradient key={serie.key} id={`fill-${serie.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={palette[index % palette.length]} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={palette[index % palette.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey={props.xKey} tickFormatter={formatTick} minTickGap={24} {...axis} />
              <YAxis tickFormatter={(value: number) => compactFormat.format(value)} width={48} {...axis} />
              <Tooltip {...tooltipStyle} labelFormatter={formatTick} formatter={(value) => formatValue(value, props.unit)} />
              {props.series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
              {props.series.map((serie, index) =>
                props.area ? (
                  <Area
                    key={serie.key}
                    type="monotone"
                    dataKey={serie.key}
                    name={serie.label}
                    stroke={palette[index % palette.length]}
                    fill={`url(#fill-${serie.key})`}
                    strokeWidth={2}
                  />
                ) : (
                  <Line key={serie.key} type="monotone" dataKey={serie.key} name={serie.label} stroke={palette[index % palette.length]} strokeWidth={2} dot={false} />
                ),
              )}
            </Chart>
          </ResponsiveContainer>
        </div>
      )
    },

    BarChart: ({ props }) => {
      const data = props.data ?? []
      const horizontal = Boolean(props.horizontal)
      return (
        <div className="w-full" style={{ height: horizontal ? Math.max(160, data.length * 36) : 224 }}>
          <ResponsiveContainer>
            <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, bottom: 0, left: horizontal ? 8 : -12 }}>
              <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke="var(--border)" />
              {horizontal ? (
                <>
                  <XAxis type="number" tickFormatter={(value: number) => compactFormat.format(value)} {...axis} />
                  <YAxis type="category" dataKey={props.xKey} width={110} {...axis} />
                </>
              ) : (
                <>
                  <XAxis dataKey={props.xKey} tickFormatter={formatTick} {...axis} />
                  <YAxis tickFormatter={(value: number) => compactFormat.format(value)} width={48} {...axis} />
                </>
              )}
              <Tooltip {...tooltipStyle} labelFormatter={formatTick} formatter={(value) => formatValue(value, props.unit)} />
              {props.series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
              {props.series.map((serie, index) => (
                <Bar
                  key={serie.key}
                  dataKey={serie.key}
                  name={serie.label}
                  fill={palette[index % palette.length]}
                  stackId={props.stacked ? 'stack' : undefined}
                  radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                  maxBarSize={36}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )
    },

    DonutChart: ({ props }) => {
      const data = props.data ?? []
      const total = data.reduce((sum, item) => sum + Number(item[props.valueKey] ?? 0), 0)
      return (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative size-44 shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey={props.valueKey} nameKey={props.nameKey} innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none">
                  {data.map((_, index) => (
                    <Cell key={index} fill={palette[index % palette.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(value) => formatValue(value, props.unit)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold tabular-nums">{compactFormat.format(total)}</span>
              {props.unit && <span className="text-[11px] text-muted-foreground">{props.unit}</span>}
            </div>
          </div>
          <ul className="flex w-full flex-col gap-1.5 text-sm">
            {data.map((item, index) => {
              const value = Number(item[props.valueKey] ?? 0)
              return (
                <li key={index} className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: palette[index % palette.length] }} />
                  <span className="truncate">{String(item[props.nameKey])}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">{total ? Math.round((value / total) * 100) : 0} %</span>
                </li>
              )
            })}
          </ul>
        </div>
      )
    },

    Table: ({ props }) => (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              {props.columns.map((column) => (
                <th key={column.key} className={cn('px-2 py-1.5 font-medium', column.align === 'right' ? 'text-right' : 'text-left')}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(props.data ?? []).map((item, index) => (
              <tr key={index} className="border-b last:border-0">
                {props.columns.map((column) => {
                  const value = item[column.key]
                  const text =
                    column.format === 'number' && typeof value === 'number'
                      ? numberFormat.format(value)
                      : column.format === 'percent' && typeof value === 'number'
                        ? `${numberFormat.format(value)} %`
                        : column.format === 'date'
                          ? formatTick(value)
                          : String(value ?? '—')
                  return (
                    <td key={column.key} className={cn('px-2 py-1.5', column.align === 'right' && 'text-right tabular-nums')}>
                      {text}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),

    Badge: ({ props }) => (
      <Badge variant="secondary" className={cn('w-fit', toneClass[props.tone ?? 'default'])}>
        {props.label}
      </Badge>
    ),
  },
})
