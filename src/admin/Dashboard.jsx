import React, { useMemo } from 'react';
import { getMetrics, getEvents } from '../lib/analytics';

// Escapa un campo CSV:
// - convierte a string
// - elimina CR/LF -> espacio
// - duplica comillas dobles
// - y lo envuelve entre comillas (") para que soporte comas
function csvField(value) {
    const s = String(value ?? '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/"/g, '""');
    return `"${s}"`;
}

export default function Dashboard() {
    const m = useMemo(() => getMetrics(), []);
    const rows = useMemo(
        () => Object.entries(m.byDay).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
        [m]
    );
    const max = rows.reduce((mx, [, v]) => Math.max(mx, v), 0) || 1;

    const downloadCSV = () => {
        const ev = getEvents() || [];

        // ✅ Separador de línea definido por código: NUNCA un literal con salto
        const NL = String.fromCharCode(13, 10); // CRLF

        const header = 'ts,type,payload';
        const data = ev.map((e) => {
            const ts = new Date(e.ts).toISOString();
            const type = e.type ?? '';
            const payload = JSON.stringify(e.payload ?? {});
            // Envolvemos cada campo correctamente para CSV
            return [csvField(ts), csvField(type), csvField(payload)].join(',');
        });

        const csv = [header, ...data].join(NL);

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'events.csv';
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div className="card" style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 className="font-semibold">Estadísticas</h3>
                <button className="btn btn-outline" onClick={downloadCSV}>
                    Exportar CSV
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <KPI label="Certificados" value={m.issued} />
                <KPI label="Aprobados test" value={m.quizPass} />
                <KPI label="Fallos test" value={m.quizFail} />
            </div>

            <div>
                <div style={{ fontSize: 14, color: '#334155', marginBottom: 4 }}>Certificados por día</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 96 }}>
                    {rows.map(([d, v]) => (
                        <div key={d} title={`${d}: ${v}`} style={{ width: 10, height: (v / max) * 90 + 10, background: '#0ea5e9' }} />
                    ))}
                </div>
            </div>
        </div>
    );
}

function KPI({ label, value }) {
    return (
        <div style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <div style={{ fontSize: 14, color: '#64748b' }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
        </div>
    );
}