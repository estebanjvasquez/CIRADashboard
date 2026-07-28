import { describe, it, expect } from 'vitest';
import { parseJsonFields, parseMetadata, parseOutputHtml } from '../../src/etl/parsers';
import sampleLogs from '../fixtures/sample_log.json';

describe('ETL Parsers Unit Tests', () => {
  it('should correctly parse valid respuesta_ia JSON', () => {
    const sample = sampleLogs[0];
    const parsed = parseJsonFields(sample.respuesta_ia);
    expect(parsed.isValid).toBe(true);
    expect(parsed.queryIntent).toBe('COMPANY');
    expect(parsed.hasFilter).toBe(true);
  });

  it('should gracefully handle invalid respuesta_ia JSON', () => {
    const parsed = parseJsonFields('invalid json string');
    expect(parsed.isValid).toBe(false);
    expect(parsed.queryIntent).toBe('NO_JSON');
  });

  it('should parse metadata correctly', () => {
    const sample = sampleLogs[0];
    const parsed = parseMetadata(sample.metadata);
    expect(parsed.isValid).toBe(true);
    expect(parsed.modelo).toBe('Gemini-3-Flash');
    expect(parsed.ipUsuario).toBe('190.122.223.131');
  });

  it('should parse common forwarded IP metadata variants', () => {
    const parsed = parseMetadata(
      '{"x-forwarded-for":"10.0.0.1, 10.0.0.2","cf-ipcountry":"VE","city":"Caracas","region":"Distrito Capital"}',
    );
    expect(parsed.isValid).toBe(true);
    expect(parsed.ipUsuario).toBe('10.0.0.1');
    expect(parsed.country).toBe('VE');
    expect(parsed.city).toBe('Caracas');
    expect(parsed.region).toBe('Distrito Capital');
  });

  it('should extract indicators from output HTML', () => {
    const sample = sampleLogs[0];
    const parsed = parseOutputHtml(sample.output);
    expect(parsed.resultadosEncontrados).toBe(1);
    expect(parsed.tieneWeb).toBe(true);
    expect(parsed.webDetectada).toBe('https://tallercomercio.com');
    expect(parsed.rifDetectado).toBe('J-12345678-9');
  });
});
