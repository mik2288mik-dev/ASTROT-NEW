import { NextRequest, NextResponse } from 'next/server';
import {
  API_CORS_ALLOW_HEADERS,
  API_CORS_ALLOW_METHODS,
  isAllowedNativeOrigin,
} from './lib/apiCors';

function addVaryOrigin(headers: Headers): void {
  const current = headers.get('Vary');
  const values = new Set((current || '').split(',').map((value) => value.trim()).filter(Boolean));
  values.add('Origin');
  headers.set('Vary', Array.from(values).join(', '));
}

function addCorsHeaders(response: NextResponse, origin: string): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', API_CORS_ALLOW_METHODS);
  response.headers.set('Access-Control-Allow-Headers', API_CORS_ALLOW_HEADERS);
  addVaryOrigin(response.headers);
  return response;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return NextResponse.next();

  const sameOrigin = origin.replace(/\/+$/, '') === request.nextUrl.origin.replace(/\/+$/, '');
  if (sameOrigin) return NextResponse.next();

  if (!isAllowedNativeOrigin(origin)) {
    const response = NextResponse.json(
      { error: 'CORS_ORIGIN_DENIED', message: 'Origin is not allowed' },
      { status: 403 }
    );
    addVaryOrigin(response.headers);
    return response;
  }

  if (request.method === 'OPTIONS') {
    return addCorsHeaders(new NextResponse(null, { status: 204 }), origin);
  }

  return addCorsHeaders(NextResponse.next(), origin);
}

export const config = {
  matcher: '/api/:path*',
};
