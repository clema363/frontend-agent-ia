import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isInJournalPeriod, journalDay } from '../src/lib/journal-period.ts'

process.env.TZ = 'Europe/Paris'
const now = new Date('2026-10-12T12:00:00+02:00')
const filters = (period: string, from = '', to = '') => ({ period, from, to })

test('today includes local midnight and excludes adjacent days', () => {
  assert.equal(isInJournalPeriod('2026-10-11T22:00:00Z', filters('today'), now), true)
  assert.equal(isInJournalPeriod('2026-10-11T21:59:59Z', filters('today'), now), false)
  assert.equal(isInJournalPeriod('2026-10-12T22:00:00Z', filters('today'), now), false)
  assert.equal(journalDay('2026-10-11T22:00:00Z'), '2026-10-12')
})

test('seven and thirty days include today and the correct first calendar day', () => {
  for (const [period, first] of [['7', '2026-10-06'], ['30', '2026-09-13']]) {
    const start = new Date(`${first}T00:00:00+02:00`)
    assert.equal(isInJournalPeriod(start.toISOString(), filters(period), now), true)
    assert.equal(isInJournalPeriod(new Date(start.getTime() - 1).toISOString(), filters(period), now), false)
  }
})

test('custom ranges include the whole end date across daylight saving', () => {
  const range = filters('custom', '2026-10-25', '2026-10-25')
  assert.equal(isInJournalPeriod('2026-10-24T22:00:00Z', range, now), true)
  assert.equal(isInJournalPeriod('2026-10-25T22:59:59Z', range, now), true)
  assert.equal(isInJournalPeriod('2026-10-25T23:00:00Z', range, now), false)
})

test('open and invalid custom ranges and all time behave correctly', () => {
  assert.equal(isInJournalPeriod('2026-10-01T12:00:00Z', filters('all'), now), true)
  assert.equal(isInJournalPeriod('2026-10-01T12:00:00Z', filters('custom', '', '2026-10-01'), now), true)
  assert.equal(isInJournalPeriod('2026-10-01T12:00:00Z', filters('custom', '2026-10-02'), now), false)
  assert.equal(isInJournalPeriod('2026-10-01T12:00:00Z', filters('custom', '2026-10-02', '2026-10-01'), now), false)
  assert.equal(isInJournalPeriod('invalid', filters('all'), now), false)
})
