cat > src / components / QuestionsEditor.jsx << 'EOF'
import React, { useMemo, useRef, useState } from 'react';
import { useConfig } from '../hooks/useConfig';
import { ALL_LANGS, LANG_LABEL, getEnabledLangs } from '../lib/langs';

/* ===========================
   Normalización del JSON
   =========================== */

function normalizeImportedQuestions(raw, enabledLangs) {
    if (!raw || typeof raw !== 'object') throw new Error('JSON vacío o inválido');

    const src = raw.questions && typeof raw.questions === 'object' ? raw.questions : raw;

    if (src.visita || src.contrata) {
        return {
            visita: Array.isArray(src.visita) ? src.visita : [],
            contrata: Array.isArray(src.contrata) ? src.contrata : []
        };
    }

    const langsAsKeys = enabledLangs.filter(l => src[l] && typeof src[l] === 'object');
    if (langsAsKeys.length) {
        const mergeType = (type) =>
            langsAsKeys.reduce((acc, l) => {
                const arr = src[l]?.[type];
                if (Array.isArray(arr)) {
                    arr.forEach((q, idx) => {
                        acc[idx] = acc[idx] || {};
                        acc[idx].id = q.id ?? acc[idx].id ?? `${type}_${idx + 1}`;
                        acc[idx].type = q.type ?? acc[idx].type ?? 'single';
                        const text = q.text || q.title || q.pregunta || '';
                        if (text) {
                            acc[idx].text = { ...(acc[idx].text || {}), [l]: text };
                        }
                        if (Array.isArray(q.options)) {
                            acc[idx].options = acc[idx].options || [];
                            q.options.forEach((opt, j) => {
                                acc[idx].options[j] = acc[idx].options[j] || {};
                                const t = (opt.text || opt.label || opt.opcion || '').toString();
                                if (t) {
                                    acc[idx].options[j].text = {
                                        ...(acc[idx].options[j].text || {}),
                                        [l]: t
                                    };
                                }
                                if (typeof opt.correct === 'boolean') acc[idx].options[j].correct = opt.correct;
                            });
                        }
                        if (typeof q.required === 'boolean') acc[idx].required = q.required;
                    });
                }
                return acc;
            }, []);

        return {
            visita: mergeType('visita'),
            contrata: mergeType('contrata')
        };
    }

    const isTypeLang =
        (src.visita && typeof src.visita === 'object' && Object.keys(src.visita).some(k => Array.isArray(src.visita[k]))) ||
        (src.contrata && typeof src.contrata === 'object' && Object.keys(src.contrata).some(k => Array.isArray(src.contrata[k])));

    if (isTypeLang) {
        const build = (type) => {
            const byLang = src[type] || {};
            const langKeys = Object.keys(byLang).filter(k => Array.isArray(byLang[k]));
            const maxLen = Math.max(0, ...langKeys.map(k => byLang[k].length));
            const out = [];
            for (let i = 0; i < maxLen; i++) {
                const base = { id: `${type}_${i + 1}`, type: 'single' };
                langKeys.forEach(l => {
                    const q = byLang[l][i];
                    if (!q) return;
                    const t = (q.text || q.title || '').toString();
                    if (t) base.text = { ...(base.text || {}), [l]: t };
                    if (Array.isArray(q.options)) {
                        base.options = base.options || [];
                        q.options.forEach((opt, j) => {
                            base.options[j] = base.options[j] || {};
                            const ot = (opt.text || opt.label || '').toString();
                            if (ot) {
                                base.options[j].text = { ...(base.options[j].text || {}), [l]: ot };
                            }
                            if (typeof opt.correct === 'boolean') base.options[j].correct = opt.correct;
                        });
                    }
                    if (typeof q.required === 'boolean') base.required = q.required;
                });
                out.push(base);
            }
            return out;
        };
        return {
            visita: build('visita'),
            contrata: build('contrata')
        };
    }

    if (Array.isArray(src)) return { visita: src, contrata: [] };

    throw new Error('Estructura de preguntas no reconocida');
}

/* ===========================
   Validación mínima
   =========================== */
function validateQuestionsStruct(qs) {
    const types = ['visita', 'contrata'];
    types.forEach(t => {
        const arr = qs[t];
        if (!Array.isArray(arr)) throw new Error(`'${t}' debe ser un array`);
        arr.forEach((q, i) => {
            if (!q) throw new Error(`Pregunta inválida en ${t}[${i}]`);
            if (!q.text && !q.title) throw new Error(`Falta 'text' o 'title' en ${t}[${i}]`);
            if (q.options && !Array.isArray(q.options)) {
                throw new Error(`'options' debe ser un array en ${t}[${i}]`);
            }
        });
    });
}

/* ===========================
   Componente
   =========================== */

export default function QuestionsEditor() {
    const { cfg, saveOverrides } = useConfig();
    const enabledLangs = useMemo(() => getEnabledLangs(cfg), [cfg]);
    const [importError, setImportError] = useState('');
    const fileRef = useRef(null);

    const questions = (cfg?.questions) || { visita: [], contrata: [] };

    const handleClickUpload = () => fileRef.current?.click();

    const handleFileChange = async (e) => {
        setImportError('');
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.json')) {
            setImportError('Selecciona un archivo .json');
            e.target.value = '';
            return;
        }

        try {
            const text = await file.text();
            const raw = JSON.parse(text);

            const normalized = normalizeImportedQuestions(raw, enabledLangs);
            validateQuestionsStruct(normalized);

            const next = { ...(cfg || {}) };
            next.questions = normalized; // SIEMPRE GLOBAL
            await saveOverrides(next);

            e.target.value = '';
            alert('Preguntas importadas (global) y guardadas correctamente.');
        } catch (err) {
            console.error(err);
            setImportError(err.message || 'No se pudo importar el JSON');
            e.target.value = '';
        }
    };

    const handleDownload = () => {
        const toSave = cfg?.questions || { visita: [], contrata: [] };
        const blob = new Blob([JSON.stringify(toSave, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'questions.json';
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" onClick={handleDownload}>Descargar JSON</button>
                <button className="btn" onClick={handleClickUpload}>Cargar JSON (global)</button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="application/json"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
            </div>

            {!!importError && (
                <p style={{ color: '#b91c1c', fontSize: 13 }}>Error al importar: {importError}</p>
            )}

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Resumen actual (global)</div>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
                    {['visita', 'contrata'].map(type => (
                        <div key={type} style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                            <div style={{ fontWeight: 600, textTransform: 'uppercase' }}>{type}</div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>
                                {Array.isArray(questions?.[type]) ? `${questions[type].length} preguntas` : '—'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
EOF