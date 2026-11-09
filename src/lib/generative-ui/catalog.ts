import { defineCatalog } from '@json-render/core'
import { schema } from '@json-render/react/schema'
import { z } from 'zod'

// Components the insights agent may use to answer with UI (json-render).
// The agent only writes layout JSON; numbers come from the backend tools and are
// placed in the spec's `state`, then referenced with { "$state": "/path" }.
// Kept free of `@/` imports: scripts/export-ui-catalog.ts runs it with plain Node.

const row = z.record(z.string(), z.union([z.string(), z.number(), z.null()]))
const rows = z.array(row)
const tone = z.enum(['default', 'blue', 'green', 'amber', 'red'])

export const insightsCatalog = defineCatalog(schema, {
  components: {
    Grid: {
      props: z.object({
        columns: z.number().int().min(1).max(4).nullable(),
      }),
      slots: ['default'],
      description: 'Responsive grid. Use 2–4 columns for Metric rows; collapses to one column on small screens.',
    },
    Stack: {
      props: z.object({
        gap: z.enum(['sm', 'md', 'lg']).nullable(),
      }),
      slots: ['default'],
      description: 'Vertical stack of children. Use it as the root when the answer has several blocks.',
    },
    Card: {
      props: z.object({
        title: z.string(),
        description: z.string().nullable(),
      }),
      slots: ['default'],
      description: 'Titled container around a chart or a table.',
    },
    Text: {
      props: z.object({
        text: z.string(),
        variant: z.enum(['body', 'muted', 'heading']).nullable(),
      }),
      description: 'A short sentence or a section heading.',
    },
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
        unit: z.string().nullable(),
        change: z.number().nullable(),
        changeLabel: z.string().nullable(),
        // Whether a rising value is good (tokens spent: false; stories created: true).
        higherIsBetter: z.boolean().nullable(),
      }),
      description: 'KPI tile: label, big value, optional % change vs the previous period (change: 12.5 means +12.5%).',
    },
    LineChart: {
      props: z.object({
        data: rows,
        xKey: z.string(),
        series: z.array(z.object({ key: z.string(), label: z.string() })).min(1).max(4),
        unit: z.string().nullable(),
        area: z.boolean().nullable(),
      }),
      description: 'Values over time. data is an array of rows, xKey the date column, series the numeric columns. Bind data with { "$state": "/..." }.',
    },
    BarChart: {
      props: z.object({
        data: rows,
        xKey: z.string(),
        series: z.array(z.object({ key: z.string(), label: z.string() })).min(1).max(4),
        unit: z.string().nullable(),
        horizontal: z.boolean().nullable(),
        stacked: z.boolean().nullable(),
      }),
      description: 'Compare categories (people, projects, agents). horizontal: true for rankings with long names.',
    },
    DonutChart: {
      props: z.object({
        data: rows,
        nameKey: z.string(),
        valueKey: z.string(),
        unit: z.string().nullable(),
      }),
      description: 'Share of a total across at most 6 categories.',
    },
    Table: {
      props: z.object({
        data: rows,
        columns: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            align: z.enum(['left', 'right']).nullable(),
            format: z.enum(['text', 'number', 'percent', 'date']).nullable(),
          }),
        ),
      }),
      description: 'Detailed rows. Prefer it over a chart when exact values matter.',
    },
    Badge: {
      props: z.object({
        label: z.string(),
        tone: tone.nullable(),
      }),
      description: 'Small status label.',
    },
  },
  actions: {},
})

export const insightsPromptOptions = {
  system:
    'You are the analytics assistant of Atlas. You answer questions about usage (tokens, chats, user stories, agents) with a short sentence followed by a UI built only from the components below.',
  customRules: [
    'Never invent numbers: call the analytics tools first, put their results in /state and bind props with { "$state": "/..." }.',
    'Start with a Grid of 2–4 Metric tiles when the question asks for totals, then a chart in a Card.',
    'Use LineChart for time series, BarChart for rankings or comparisons, DonutChart for shares, Table when exact values matter.',
    'Keep labels in French.',
  ],
}
