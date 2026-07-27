export const onRequest: PagesFunction = async ({ next, request }) => {
  const url = new URL(request.url);
  if (url.pathname === '/api/health') return next();

  if (url.hostname.endsWith('.pages.dev')) {
    return Response.json(
      { error: 'Use the protected custom domain for analytics APIs.' },
      { status: 403 },
    );
  }

  return next();
};
