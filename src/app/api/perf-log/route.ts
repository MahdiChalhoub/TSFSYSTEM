import { NextRequest, NextResponse } from 'next/server';

/**
 * In-memory buffer for performance samples. 
 * Since PM2 runs a single process, this acts as a live cache.
 * We store the last 100 samples to provide global averages on the dashboard.
 */
let samples: any[] = [];
const MAX_SAMPLES = 100;

export async function GET() {
    if (samples.length === 0) {
        return NextResponse.json({ 
            count: 0, 
            avg_ms: 0, 
            slow_percent: 0, 
            recent: [] 
        });
    }
    
    const totalMs = samples.reduce((acc, s) => acc + (Number(s.durationMs) || 0), 0);
    const slowCount = samples.filter(s => (Number(s.durationMs) || 0) > 800).length;
    
    return NextResponse.json({
        count: samples.length,
        avg_ms: Math.round(totalMs / samples.length),
        slow_percent: Math.round((slowCount / samples.length) * 100),
        recent: samples.slice(-10).reverse()
    });
}

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();
        
        // Add timestamp and ensure duration is numeric
        const sample = {
            label: typeof payload.label === 'string' ? payload.label : 'unknown',
            durationMs: Number(payload.durationMs) || 0,
            success: !!payload.success,
            route: typeof payload.route === 'string' ? payload.route : '',
            ts: Date.now(),
            kind: payload.kind || 'action'
        };
        
        samples.push(sample);
        
        // Sliding window management
        if (samples.length > MAX_SAMPLES) {
            samples.shift();
        }
        
        // Log slow interactions to server console for grep-ability
        if (sample.durationMs > 800) {
            console.warn(`[PERF-SLOW] ${sample.label} took ${sample.durationMs}ms on ${sample.route}`);
        }
        
        return new NextResponse(null, { status: 204 });
    } catch {
        return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
}
