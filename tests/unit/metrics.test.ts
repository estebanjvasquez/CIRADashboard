import { describe, expect, it } from 'vitest';
import { buildSummary } from '../../src/etl/metrics';
import sampleLogs from '../fixtures/sample_log.json';

describe('summary metrics', () => {
  it('builds executive summary metrics from raw logs', () => {
    const summary = buildSummary(sampleLogs, {
      ipHashSalt: 'test-salt',
      parserVersion: '1.0.0',
      reportTimezone: 'America/New_York',
    });

    expect(summary.totalQueries).toBe(1);
    expect(summary.uniqueSessions).toBe(1);
    expect(summary.uniqueUsers).toBe(1);
    expect(summary.avgTokens).toBe(65);
    expect(summary.responsesWithWebsiteRate).toBe(1);
    expect(summary.parserVersion).toBe('1.0.0');
  });
});
