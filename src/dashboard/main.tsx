import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

interface Summary {
  totalQueries: number;
  uniqueSessions: number;
  uniqueUsers: number;
  avgTokens: number;
  totalTokens: number;
  ambiguityRate: number;
  errorRate: number;
  invalidJsonRows: number;
  responsesWithWebsiteRate: number;
  parserVersion: string;
  generatedAt: string;
}

interface TimeseriesRow {
  date: string;
  queries: number;
  tokens: number;
  errors: number;
  ambiguous: number;
}

interface RankingRow {
  label: string;
  count: number;
  percentage: number;
}

interface Quality {
  totalRows: number;
  ambiguousRows: number;
  invalidJsonRows: number;
  rowsWithWebsite: number;
  errorRows: number;
}

interface DiagnosticRow {
  logId: string;
  fechaCreacion: string;
  sessionId: string;
  preguntaUsuario: string;
  respuestaIaPreview?: string;
  outputPreview?: string;
  queryIntent?: string;
  whereClause?: string;
  humanSummary?: string;
  resultadosEncontrados: number;
  needsClarificationAi?: boolean;
  consultaAmbiguaOutput: boolean;
  reason: string;
}

interface Diagnostics {
  rows: DiagnosticRow[];
  totalMatched: number;
}

interface NoResultsRow {
  term: string;
  count: number;
  coincidesSector: boolean;
  coincidesService: boolean;
  priority: 'BUG_REAL' | 'SINONIMO' | 'RUIDO';
  action: string;
  sampleQuestion: string;
}

interface NoResults {
  rows: NoResultsRow[];
  totalMatched: number;
}

interface DemandProspectRow {
  term: string;
  count: number;
  lastSeen: string;
  sampleQuestion: string;
}

interface DemandInterestRow {
  category: string;
  count: number;
  sampleQuestion: string;
}

interface Demand {
  prospects: DemandProspectRow[];
  interests: DemandInterestRow[];
  totalProspects: number;
}

interface DashboardData {
  summary: Summary;
  timeseries: { rows: TimeseriesRow[] };
  intents: { rows: RankingRow[] };
  companies: { rows: RankingRow[] };
  categories: { rows: RankingRow[] };
  locations: { rows: RankingRow[] };
  timezones: { rows: RankingRow[] };
  quality: Quality;
  invalidJson: Diagnostics;
  ambiguous: Diagnostics;
  noResults: NoResults;
  demand: Demand;
}

function App() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const value = params.toString();
    return value ? `?${value}` : '';
  }, [from, to]);

  useEffect(() => {
    setStatus('loading');
    getJson<DashboardData>(`/dashboard${query}`)
      .then((dashboardData) => {
        setData(dashboardData);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [query]);

  return (
    <main className="app-shell">
      <section className="toolbar">
        <div>
          <p className="eyebrow">CIRA</p>
          <h1>Bot Metrics Dashboard</h1>
        </div>
        <div className="filters">
          <label>
            Desde
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <a className="health-link" href={`${apiBaseUrl}/health`}>
            API Health
          </a>
        </div>
      </section>

      {status === 'loading' && <section className="status-panel">Cargando metricas...</section>}
      {status === 'error' && (
        <section className="status-panel error">
          No se pudieron cargar las metricas. Verifica la sesion de Cloudflare Access.
        </section>
      )}
      {status === 'ready' && data && <Dashboard data={data} query={query} />}
    </main>
  );
}

function Dashboard({ data, query }: { data: DashboardData; query: string }) {
  return (
    <>
      <section className="kpi-grid">
        <MetricCard label="Consultas" value={formatNumber(data.summary.totalQueries)} />
        <MetricCard label="Sesiones" value={formatNumber(data.summary.uniqueSessions)} />
        <MetricCard label="Usuarios aprox." value={formatNumber(data.summary.uniqueUsers)} />
        <MetricCard label="Tokens totales" value={formatNumber(data.summary.totalTokens)} />
        <MetricCard label="Tokens prom." value={formatNumber(data.summary.avgTokens)} />
        <MetricCard label="Ambiguedad" value={formatPercent(data.summary.ambiguityRate)} />
        <MetricCard label="Errores" value={formatPercent(data.summary.errorRate)} />
        <MetricCard label="Con web" value={formatPercent(data.summary.responsesWithWebsiteRate)} />
      </section>

      <section className="content-grid">
        <ChartPanel title="Consultas por dia">
          <DailyBars rows={data.timeseries.rows} />
        </ChartPanel>
        <ChartPanel title="Calidad del bot">
          <QualityBars quality={data.quality} />
        </ChartPanel>
        <RankingPanel title="Empresas mas consultadas" rows={data.companies.rows} />
        <RankingPanel title="Intenciones" rows={data.intents.rows} />
        <RankingPanel title="Categorias detectadas" rows={data.categories.rows} />
        <RankingPanel title="Ubicaciones por IP" rows={data.locations.rows} />
        <RankingPanel title="Zonas horarias" rows={data.timezones.rows} />
      </section>

      <section className="status-panel">
        <h2>Estado tecnico</h2>
        <p>
          {data.summary.invalidJsonRows} filas tienen JSON invalido. Parser{' '}
          <code>{data.summary.parserVersion}</code>, generado{' '}
          {new Date(data.summary.generatedAt).toLocaleString()}.
        </p>
      </section>

      {data.demand && (
        <section className="diagnostics-grid">
          <DemandPanel
            demand={data.demand}
            downloadUrl={diagnosticCsvUrl('/demand.csv', query)}
          />
        </section>
      )}

      <section className="diagnostics-grid">
        <NoResultsPanel
          total={data.noResults.totalMatched}
          rows={data.noResults.rows}
          downloadUrl={diagnosticCsvUrl('/diagnostics/no-results.csv', query)}
        />
        <DiagnosticPanel
          title="Diagnostico JSON invalido"
          total={data.invalidJson.totalMatched}
          rows={data.invalidJson.rows}
          mode="json"
          downloadUrl={diagnosticCsvUrl('/diagnostics/invalid-json.csv', query)}
        />
        <DiagnosticPanel
          title="Diagnostico respuestas ambiguas"
          total={data.ambiguous.totalMatched}
          rows={data.ambiguous.rows}
          mode="ambiguous"
          downloadUrl={diagnosticCsvUrl('/diagnostics/ambiguous.csv', query)}
        />
      </section>
    </>
  );
}

const INTEREST_LABELS: Record<string, string> = {
  interes_afiliacion: 'Interes en afiliarse',
  interes_eventos: 'Cursos / eventos',
  busqueda_empleo: 'Busqueda de empleo',
  consulta_economica: 'Consulta economica',
  soporte_afiliado: 'Soporte de afiliado',
  otro_fuera_alcance: 'Otro / fuera de alcance',
};

function DemandPanel({ demand, downloadUrl }: { demand: Demand; downloadUrl: string }) {
  return (
    <section className="panel diagnostics-panel">
      <div className="panel-title-row">
        <div>
          <h2>Demanda y prospectos</h2>
          <p className="muted">
            {formatNumber(demand.totalProspects)} empresas buscadas que no estan afiliadas.
            Oportunidades de afiliacion e intereses del publico.
          </p>
        </div>
        <a className="download-link" href={downloadUrl}>
          Descargar prospectos CSV
        </a>
      </div>

      <h3 className="muted" style={{ margin: '4px 0' }}>Empresas no afiliadas mas buscadas</h3>
      <div className="ranking-list">
        {demand.prospects.length === 0 && <p className="muted">Sin prospectos por ahora.</p>}
        {demand.prospects.map((row) => (
          <article className="ranking-row" key={row.term}>
            <div>
              <strong>{row.term}</strong>
              <span>{new Date(row.lastSeen).toLocaleDateString()}</span>
            </div>
            <em>{formatNumber(row.count)}</em>
          </article>
        ))}
      </div>

      <h3 className="muted" style={{ margin: '12px 0 4px' }}>Otros intereses del publico</h3>
      <div className="ranking-list">
        {demand.interests.length === 0 && <p className="muted">Sin intereses registrados.</p>}
        {demand.interests.map((row) => (
          <article className="ranking-row" key={row.category}>
            <div>
              <strong>{INTEREST_LABELS[row.category] || row.category}</strong>
              <span>{row.sampleQuestion}</span>
            </div>
            <em>{formatNumber(row.count)}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function NoResultsPanel({
  total,
  rows,
  downloadUrl,
}: {
  total: number;
  rows: NoResultsRow[];
  downloadUrl: string;
}) {
  return (
    <section className="panel diagnostics-panel">
      <div className="panel-title-row">
        <div>
          <h2>Consultas sin resultado</h2>
          <p className="muted">
            {formatNumber(total)} casos detectados. Priorizadas por bug real o sinonimo.
          </p>
        </div>
        <a className="download-link" href={downloadUrl}>
          Descargar CSV
        </a>
      </div>
      <div className="diagnostic-list">
        {rows.length === 0 && <p className="muted">Sin consultas sin resultado.</p>}
        {rows.map((row) => (
          <article className="diagnostic-row" key={row.term}>
            <div className="diagnostic-head">
              <strong>{row.term}</strong>
              <span>{row.priority}</span>
            </div>
            <dl>
              <div>
                <dt>Veces</dt>
                <dd>{formatNumber(row.count)}</dd>
              </div>
              <div>
                <dt>Catalogo</dt>
                <dd>{row.coincidesSector || row.coincidesService ? 'Coincide' : 'No coincide'}</dd>
              </div>
              <div>
                <dt>Accion</dt>
                <dd>{row.action}</dd>
              </div>
            </dl>
            <p className="muted">{row.sampleQuestion}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function DailyBars({ rows }: { rows: TimeseriesRow[] }) {
  const max = Math.max(...rows.map((row) => row.queries), 1);
  return (
    <div className="bar-chart">
      {rows.map((row) => (
        <div className="bar-row" key={row.date}>
          <span>{row.date}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(row.queries / max) * 100}%` }} />
          </div>
          <strong>{formatNumber(row.queries)}</strong>
        </div>
      ))}
    </div>
  );
}

function QualityBars({ quality }: { quality: Quality }) {
  const rows = [
    { label: 'Ambiguas', value: quality.ambiguousRows },
    { label: 'JSON invalido', value: quality.invalidJsonRows },
    { label: 'Con web', value: quality.rowsWithWebsite },
    { label: 'Errores', value: quality.errorRows },
  ];
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="bar-chart">
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <span>{row.label}</span>
          <div className="bar-track">
            <div className="bar-fill quality" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
          <strong>{formatNumber(row.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function RankingPanel({ title, rows }: { title: string; rows: RankingRow[] }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="ranking-list">
        {rows.length === 0 && <p className="muted">Sin datos detectados.</p>}
        {rows.map((row) => (
          <article className="ranking-row" key={row.label}>
            <div>
              <strong>{row.label}</strong>
              <span>{formatPercent(row.percentage)}</span>
            </div>
            <em>{formatNumber(row.count)}</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function DiagnosticPanel({
  title,
  total,
  rows,
  mode,
  downloadUrl,
}: {
  title: string;
  total: number;
  rows: DiagnosticRow[];
  mode: 'json' | 'ambiguous';
  downloadUrl: string;
}) {
  return (
    <section className="panel diagnostics-panel">
      <div className="panel-title-row">
        <div>
          <h2>{title}</h2>
          <p className="muted">{formatNumber(total)} filas detectadas. Mostrando muestra reciente.</p>
        </div>
        <a className="download-link" href={downloadUrl}>
          Descargar CSV
        </a>
      </div>
      <div className="diagnostic-list">
        {rows.length === 0 && <p className="muted">Sin casos para revisar.</p>}
        {rows.map((row) => (
          <article className="diagnostic-row" key={`${mode}-${row.logId}`}>
            <div className="diagnostic-head">
              <strong>{new Date(row.fechaCreacion).toLocaleString()}</strong>
              <span>{row.reason}</span>
            </div>
            <p>{row.preguntaUsuario}</p>
            {mode === 'json' && row.respuestaIaPreview && <code>{row.respuestaIaPreview}</code>}
            {mode === 'ambiguous' && (
              <dl>
                <div>
                  <dt>Intent</dt>
                  <dd>{row.queryIntent || 'N/D'}</dd>
                </div>
                <div>
                  <dt>Resultados</dt>
                  <dd>{formatNumber(row.resultadosEncontrados)}</dd>
                </div>
                <div>
                  <dt>Resumen</dt>
                  <dd>{row.humanSummary || 'N/D'}</dd>
                </div>
              </dl>
            )}
            {row.outputPreview && <p className="muted">{row.outputPreview}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function diagnosticCsvUrl(path: string, query: string): string {
  const separator = query ? '&' : '?';
  return `${apiBaseUrl}${path}${query}${separator}limit=500`;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Request failed: ${path}`);
  return response.json();
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('es-VE', {
    maximumFractionDigits: 1,
    style: 'percent',
  }).format(value);
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
