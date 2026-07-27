interface Env {
  PARSER_VERSION: string;
  REPORT_TIMEZONE: string;
  SUPABASE_TABLE: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return Response.json({
    status: 'ok',
    parserVersion: env.PARSER_VERSION,
    reportTimezone: env.REPORT_TIMEZONE,
    supabaseTable: env.SUPABASE_TABLE,
    hasSupabaseUrl: Boolean(env.SUPABASE_URL),
    hasSupabaseServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    timestamp: new Date().toISOString(),
  });
};
