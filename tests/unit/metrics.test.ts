import { describe, expect, it } from 'vitest';
import {
  buildCategoryRanking,
  buildAmbiguousDiagnostics,
  buildCompanyRanking,
  buildInvalidJsonDiagnostics,
  buildIntentRanking,
  buildQuality,
  buildSummary,
  buildTimeseries,
} from '../../src/etl/metrics';
import sampleLogs from '../fixtures/sample_log.json';

describe('summary metrics', () => {
  it('builds executive summary metrics from raw logs', async () => {
    const summary = await buildSummary(sampleLogs, {
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

  it('builds timeseries rows grouped by report timezone date', () => {
    const timeseries = buildTimeseries(sampleLogs, {
      parserVersion: '1.0.0',
      reportTimezone: 'America/New_York',
    });

    expect(timeseries.rows).toEqual([
      { date: '2026-07-27', queries: 1, tokens: 65, errors: 0, ambiguous: 0 },
    ]);
  });

  it('builds quality metrics from raw logs', () => {
    const quality = buildQuality(sampleLogs, { parserVersion: '1.0.0' });

    expect(quality.totalRows).toBe(1);
    expect(quality.errorRate).toBe(0);
    expect(quality.responsesWithWebsiteRate).toBe(1);
  });

  it('builds rankings from parsed JSON and fallback company text', () => {
    const intents = buildIntentRanking(sampleLogs, { parserVersion: '1.0.0' });
    const companies = buildCompanyRanking(sampleLogs, { parserVersion: '1.0.0' });
    const categories = buildCategoryRanking(sampleLogs, { parserVersion: '1.0.0' });

    expect(intents.rows[0]).toMatchObject({ label: 'COMPANY', count: 1 });
    expect(companies.rows[0].label).toContain('TALLER COMERCIO');
    expect(categories.rows).toEqual([]);
  });

  it('builds diagnostics for invalid JSON and ambiguous responses', () => {
    const rows = [
      ...sampleLogs,
      {
        ...sampleLogs[0],
        id: 'invalid-json',
        respuesta_ia: '```json {"bad": true}',
      },
      {
        ...sampleLogs[0],
        id: 'ambiguous',
        respuesta_ia:
          '{"queryIntent":"COMPANY","needsClarification":true,"humanSummary":"Consulta ambigua"}',
        output: '<div>Te refieres a alguna de estas empresas? Encontré <strong>3</strong></div>',
      },
    ];

    const invalidJson = buildInvalidJsonDiagnostics(rows, {
      limit: 10,
      parserVersion: '1.0.0',
    });
    const ambiguous = buildAmbiguousDiagnostics(rows, {
      limit: 10,
      parserVersion: '1.0.0',
    });

    expect(invalidJson.totalMatched).toBe(1);
    expect(invalidJson.rows[0].reason).toBe('JSON envuelto en Markdown');
    expect(ambiguous.totalMatched).toBe(1);
    expect(ambiguous.rows[0].reason).toContain('needsClarification=true');
  });
});
