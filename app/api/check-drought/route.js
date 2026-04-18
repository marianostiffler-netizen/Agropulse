import { NextResponse } from 'next/server';
import { analyzeArea } from '@/lib/earthengine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function parseBody(body) {
  // Compatibilidad hacia atrás: body plano con lat/lon => Point
  if (body && body.geometry == null && body.lat != null && body.lon != null) {
    return {
      type: 'Point',
      lat: Number(body.lat),
      lon: Number(body.lon),
      bufferMeters: body.bufferMeters != null ? Number(body.bufferMeters) : 100,
    };
  }
  const g = body?.geometry;
  if (!g || typeof g !== 'object') {
    return { error: 'Falta geometry en el body.' };
  }
  if (g.type === 'Point') {
    const lat = Number(g.lat);
    const lon = Number(g.lon);
    const bufferMeters = g.bufferMeters != null ? Number(g.bufferMeters) : 100;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { error: 'Point requiere lat y lon numéricos.' };
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return { error: 'Coordenadas fuera de rango.' };
    }
    if (!Number.isFinite(bufferMeters) || bufferMeters < 10 || bufferMeters > 5000) {
      return { error: 'bufferMeters debe estar entre 10 y 5000.' };
    }
    return { type: 'Point', lat, lon, bufferMeters };
  }
  if (g.type === 'Polygon') {
    const coords = g.coordinates;
    if (!Array.isArray(coords) || coords.length < 3) {
      return { error: 'Polygon requiere al menos 3 vértices.' };
    }
    const parsed = coords.map((c) => [Number(c[0]), Number(c[1])]);
    if (parsed.some(([lon, lat]) => !Number.isFinite(lon) || !Number.isFinite(lat))) {
      return { error: 'Polygon: coordenadas inválidas.' };
    }
    return { type: 'Polygon', coordinates: parsed };
  }
  return { error: 'geometry.type debe ser Point o Polygon.' };
}

async function handle(input) {
  if (input.error) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }
  try {
    const result = await analyzeArea(input);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[check-drought] error:', err);
    return NextResponse.json(
      { error: err.message || 'Error interno procesando la solicitud.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 });
  }
  return handle(parseBody(body));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const body = {
    lat: searchParams.get('lat'),
    lon: searchParams.get('lon'),
    bufferMeters: searchParams.get('bufferMeters'),
  };
  return handle(parseBody(body));
}
