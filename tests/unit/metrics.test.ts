import { describe, expect, it } from 'vitest';
import {
  buildCategoryRanking,
  buildAmbiguousDiagnostics,
  buildCompanyRanking,
  buildInvalidJsonDiagnostics,
  buildLocationRanking,
  buildTimezoneRanking,
  buildNoResultsDiagnostics,
  buildIntentRanking,
  buildQuality,
  buildSummary,
  buildTimeseries,
  diagnosticsToCsv,
  noResultsToCsv,
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

  it('builds location ranking from user metadata before company output location', () => {
    const locations = buildLocationRanking(
      [
        {
          ...sampleLogs[0],
          metadata:
            '{"x-forwarded-for":"10.0.0.1","cf-ipcountry":"VE","city":"Caracas","region":"Distrito Capital"}',
        },
      ],
      { parserVersion: '1.0.0' },
    );

    expect(locations.rows[0]).toMatchObject({
      label: 'CARACAS, DISTRITO CAPITAL, VE',
      count: 1,
    });
  });

  it('uses the v_logs IP column as the location source without exposing the address', () => {
    const locations = buildLocationRanking(
      [{ ...sampleLogs[0], ip: '8.8.8.8', output: '<div>Ubicacion: Maracaibo, Zulia</div>' }],
      { parserVersion: '1.0.0' },
    );

    expect(locations.rows).toEqual([
      expect.objectContaining({ label: 'IP DETECTADA SIN GEOLOCALIZAR', count: 1 }),
    ]);
    expect(locations.rows[0].label).not.toContain('8.8.8.8');
    expect(locations.rows[0].label).not.toContain('MARACAIBO');
  });

  it('builds timezone ranking from flattened v_logs fields and metadata fallback', () => {
    const timezones = buildTimezoneRanking(
      [
        { ...sampleLogs[0], timezone: 'America/Caracas' },
        { ...sampleLogs[0], metadata: '{"timezone":"America/New_York"}' },
        { ...sampleLogs[0], timezone: 'America/Caracas' },
      ],
      { parserVersion: '1.0.0' },
    );

    expect(timezones.rows).toEqual([
      expect.objectContaining({ label: 'AMERICA/CARACAS', count: 2 }),
      expect.objectContaining({ label: 'AMERICA/NEW_YORK', count: 1 }),
    ]);
  });

  it('uses flattened v_logs metadata fields when available', async () => {
    const rows = [
      {
        ...sampleLogs[0],
        id: 'flat-ok',
        visitor_id: 'visitor-1',
        ip: '198.51.100.10',
        query_intent: 'SERVICE',
        resultado_tipo: 'results',
        needs_clarification: true,
        geo_ciudad: 'Maracaibo',
        geo_region: 'Zulia',
        geo_pais: 'VE',
        respuesta_ia: 'not json but classified result',
      },
      {
        ...sampleLogs[0],
        id: 'flat-ambiguous',
        visitor_id: 'visitor-1',
        query_intent: 'conversation',
        resultado_tipo: 'conversation',
        needs_clarification: true,
        respuesta_ia: 'not json but classified conversation',
      },
    ];

    const summary = await buildSummary(rows, {
      ipHashSalt: 'test-salt',
      parserVersion: '1.0.0',
      reportTimezone: 'America/New_York',
    });
    const intents = buildIntentRanking(rows, { parserVersion: '1.0.0' });
    const locations = buildLocationRanking(rows, { parserVersion: '1.0.0' });
    const invalidJson = buildInvalidJsonDiagnostics(rows, { limit: 10, parserVersion: '1.0.0' });
    const ambiguous = buildAmbiguousDiagnostics(rows, { limit: 10, parserVersion: '1.0.0' });

    expect(summary.uniqueUsers).toBe(1);
    expect(summary.ambiguityRate).toBe(0.5);
    expect(intents.rows[0]).toMatchObject({ label: 'SERVICE', count: 1 });
    expect(locations.rows[0]).toMatchObject({ label: 'MARACAIBO, ZULIA, VE', count: 1 });
    expect(invalidJson.totalMatched).toBe(0);
    expect(ambiguous.totalMatched).toBe(1);
    expect(ambiguous.rows[0].reason).toContain('resultado_tipo=conversation');
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
        pregunta_usuario: 'empresas de perforacion en zulia',
        respuesta_ia:
          '{"queryIntent":"SECTOR","needsClarification":true,"humanSummary":"Consulta ambigua"}',
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

  it('excludes known false positives from invalid JSON diagnostics', () => {
    const rows = [
      { ...sampleLogs[0], id: 'legacy', respuesta_ia: '[INTENT:LIST] [{"name":"ACME"}]' },
      { ...sampleLogs[0], id: 'empty-question', pregunta_usuario: '', respuesta_ia: 'not json' },
      { ...sampleLogs[0], id: 'hello', respuesta_ia: 'Hola, soy CIRA. ¿Como puedo ayudarte?' },
      { ...sampleLogs[0], id: 'no-results', respuesta_ia: 'No encontramos empresas con ese criterio.' },
      {
        ...sampleLogs[0],
        id: 'clarification-menu',
        pregunta_usuario: 'servicios petroleros',
        respuesta_ia: 'Puede referirse a A) Perforacion B) Transporte',
      },
      {
        ...sampleLogs[0],
        id: 'real-invalid',
        pregunta_usuario: "Busca KALA'S, C.A.",
        respuesta_ia: '{"whereClause":"LOWER(name) LIKE LOWER("%KALA\\S%")"}',
      },
    ];

    const invalidJson = buildInvalidJsonDiagnostics(rows, {
      limit: 10,
      parserVersion: '1.0.0',
    });

    expect(invalidJson.totalMatched).toBe(1);
    expect(invalidJson.rows[0].logId).toBe('real-invalid');
  });

  it('does not count comando_error rows as invalid JSON', () => {
    const rows = [
      {
        ...sampleLogs[0],
        id: 'wrong-pass',
        pregunta_usuario: '/aprender clavemala X: y',
        resultado_tipo: 'comando_error',
        respuesta_ia: null,
        output: '<div>Clave incorrecta. El comando no fue ejecutado.</div>',
      },
    ];

    const invalidJson = buildInvalidJsonDiagnostics(rows, { limit: 10, parserVersion: '1.0.0' });

    expect(invalidJson.totalMatched).toBe(0);
  });

  it('treats short terms as noise even when they substring-match the catalog', () => {
    const rows = [
      { ...sampleLogs[0], id: 'short-match', pregunta_usuario: 'a', respuesta_ia: 'No encontramos resultados.' },
    ];

    const noResults = buildNoResultsDiagnostics(rows, {
      sectors: ['Fabricantes'], // 'fabricantes' contiene la 'a' -> substring match
      services: [],
      limit: 10,
      parserVersion: '1.0.0',
    });

    expect(noResults.rows[0]).toMatchObject({ term: 'a', priority: 'RUIDO' });
  });

  it('classifies no-result queries as actionable vocabulary gaps', () => {
    const rows = [
      { ...sampleLogs[0], id: 'operator', pregunta_usuario: 'operadores', respuesta_ia: 'No encontramos resultados.' },
      { ...sampleLogs[0], id: 'cranes', pregunta_usuario: 'gruas', respuesta_ia: 'No encontramos resultados.' },
      { ...sampleLogs[0], id: 'noise', pregunta_usuario: 'b', respuesta_ia: 'No encontramos resultados.' },
    ];

    const invalidJson = buildInvalidJsonDiagnostics(rows, {
      limit: 10,
      parserVersion: '1.0.0',
    });
    const noResults = buildNoResultsDiagnostics(rows, {
      sectors: ['Operadores'],
      services: [],
      limit: 10,
      parserVersion: '1.0.0',
    });
    const csv = noResultsToCsv(noResults.rows);

    expect(invalidJson.totalMatched).toBe(0);
    expect(noResults.totalMatched).toBe(3);
    expect(noResults.rows[0]).toMatchObject({ term: 'operadores', priority: 'BUG_REAL' });
    expect(noResults.rows.some((row) => row.term === 'gruas' && row.priority === 'SINONIMO')).toBe(true);
    expect(noResults.rows.some((row) => row.term === 'b' && row.priority === 'RUIDO')).toBe(true);
    expect(csv).toContain('termino,veces,coincide_sector');
  });

  it('excludes known false positives from ambiguous diagnostics', () => {
    const rows = [
      {
        ...sampleLogs[0],
        id: 'company-one-result',
        respuesta_ia: '{"queryIntent":"COMPANY","needsClarification":true}',
        output: '<div>Te refieres a esta empresa? Encontré <strong>1</strong></div>',
      },
      {
        ...sampleLogs[0],
        id: 'company-detail-click',
        pregunta_usuario: 'Dame información sobre la empresa ACME',
        respuesta_ia: '{"queryIntent":"SECTOR","needsClarification":true}',
        output: '<div>Te refieres a alguna de estas empresas? Encontré <strong>3</strong></div>',
      },
      {
        ...sampleLogs[0],
        id: 'company-intent',
        pregunta_usuario: 'acme',
        respuesta_ia: '{"queryIntent":"COMPANY","needsClarification":true}',
        output: '<div>Te refieres a alguna de estas empresas? Encontré <strong>1</strong></div>',
      },
      {
        ...sampleLogs[0],
        id: 'real-ambiguous',
        pregunta_usuario: 'empresas de servicios petroleros',
        respuesta_ia: 'Su consulta puede referirse a A) Servicios de perforacion B) Servicios de transporte',
        output: '<div>No hay tarjeta de empresa</div>',
      },
    ];

    const ambiguous = buildAmbiguousDiagnostics(rows, {
      limit: 10,
      parserVersion: '1.0.0',
    });

    expect(ambiguous.totalMatched).toBe(2);
    expect(ambiguous.rows.map((row) => row.logId)).toEqual(['company-intent', 'real-ambiguous']);
  });

  it('exports diagnostics as csv', () => {
    const diagnostics = buildInvalidJsonDiagnostics(
      [{ ...sampleLogs[0], id: 'invalid-json', respuesta_ia: 'no "json"' }],
      { limit: 10, parserVersion: '1.0.0' },
    );
    const csv = diagnosticsToCsv(diagnostics.rows);

    expect(csv).toContain('log_id,fecha_creacion,session_id');
    expect(csv).toContain('"invalid-json"');
    expect(csv).toContain('"no ""json"""');
  });
});
