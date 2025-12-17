
// src/components/Quiz.jsx
import React, { useRef, useState } from 'react';
import { logEvent } from '../lib/analytics';

/**
 * Quiz
 * Props:
 *  - items: Array<{ id, text, options: string[], correct: number }>
 *  - checkLabel: string (texto del botón de enviar)
 *  - wrongLabel: string (mensaje al fallar)
 *  - retryLabel: string (texto del botón de finalizar y reintentar)
 *  - onPass: () => Promise<void> | void  (se llama cuando todo está correcto)
 *  - onRetry?: () => void
 */
export default function Quiz({
    items = [],
    checkLabel = 'Comprobar y finalizar',
    wrongLabel = 'Respuesta incorrecta. Revisa y corrige.',
    retryLabel = 'Finalizar y nuevo intento',
    onPass,
    onRetry
}) {
    const [answers, setAnswers] = useState({});
    const [formError, setFormError] = useState(null);
    const [wrongIds, setWrongIds] = useState([]);
    const [submitting, setSubmitting] = useState(false); // ⬅️ nuevo
    const qRefs = useRef({});

    const onSubmit = (e) => {
        e.preventDefault();
        if (submitting) return; // ⬅️ freno de doble clic

        const wrong = [];
        for (const q of items) {
            const a = answers[q.id];
            if (a === undefined || Number(a) !== Number(q.correct)) {
                wrong.push(q.id);
            }
        }

        if (wrong.length) {
            setWrongIds(wrong);
            setFormError(`${wrongLabel} (${wrong.length}/${items.length})`);
            logEvent('quiz_fail', { wrongCount: wrong.length });

            // Scroll a la primera incorrecta
            const firstWrongRef = qRefs.current[wrong[0]];
            firstWrongRef?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Todo correcto
        setWrongIds([]);
        setFormError(null);
        logEvent('quiz_pass', {});
        if (onPass) {
            setSubmitting(true);
            Promise.resolve(onPass())
                .catch(() => { /* opcional: mostrar toast de error */ })
                .finally(() => setSubmitting(false));
        }
    };


    const onChangeAnswer = (qid, val) => {
        // Guardar respuesta usando la clave correcta [qid]
        setAnswers((prev) => ({ ...prev, [qid]: Number(val) }));
        // Si estaba marcada incorrecta, limpiar
        setWrongIds((prev) => prev.filter((id) => id !== qid));
    };


    return (
        <form className="grid" style={{ display: 'grid', gap: 12 }} onSubmit={onSubmit}>
            {items.map((q, idx) => {
                const isWrong = wrongIds.includes(q.id);
                const fieldsetStyle = {
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 16,
                    background: '#fff',
                    ...(isWrong ? { borderColor: '#ef4444', background: '#fef2f2' } : null)
                };
                const legendStyle = { fontWeight: 600, color: isWrong ? '#b91c1c' : '#0f172a' };

                return (
                    <fieldset
                        key={q.id}
                        ref={(el) => { qRefs.current[q.id] = el; }}
                        className="card"
                        style={fieldsetStyle}
                        aria-invalid={isWrong ? 'true' : 'false'}
                    >
                        <legend style={legendStyle}>
                            {idx + 1}. {q.text}
                        </legend>

                        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                            {q.options.map((opt, i) => (
                                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                        type="radio"
                                        name={`q_${q.id}`}
                                        value={i}
                                        checked={answers[q.id] === i}
                                        onChange={(e) => onChangeAnswer(q.id, e.target.value)}
                                    />
                                    <span>{opt}</span>
                                </label>
                            ))}
                        </div>

                        {isWrong && (
                            <div style={{ marginTop: 8, fontSize: 13, color: '#b91c1c' }}>
                                {wrongLabel}
                            </div>
                        )}
                    </fieldset>
                );
            })}

            {formError && (
                <div
                    role="alert"
                    style={{
                        border: '1px solid #fca5a5',
                        background: '#fee2e2',
                        color: '#b91c1c',
                        borderRadius: 8,
                        padding: '10px 12px',
                        fontSize: 14
                    }}
                >
                    {formError}
                </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" type="submit" disabled={submitting}>
                    {submitting ? 'Generando…' : checkLabel}
                </button>

                {formError && onRetry && (
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={onRetry}
                        disabled={submitting}
                    >
                        {retryLabel}
                    </button>
                )}
            </div>
        </form>
    );
}