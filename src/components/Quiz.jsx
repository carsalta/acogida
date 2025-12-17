
import React, { useRef, useState } from 'react';
import { logEvent } from '../lib/analytics';

export default function Quiz({
    items = [],
    checkLabel = 'Comprobar y finalizar',
    wrongLabel = 'Respuesta incorrecta. Revisa y corrige.',
    onPass,
    onRetry,
    retryLabel = 'Finalizar y nuevo intento'
}) {
    const [answers, setAnswers] = useState({});
    const [formError, setFormError] = useState(null);   // mensaje global
    const [wrongIds, setWrongIds] = useState([]);       // ids de preguntas incorrectas
    const qRefs = useRef({});                           // refs por pregunta para hacer scroll

    const onSubmit = (e) => {
        e.preventDefault();

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
            if (firstWrongRef && firstWrongRef.scrollIntoView) {
                firstWrongRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // Todo correcto
        setWrongIds([]);
        setFormError(null);
        logEvent('quiz_pass', {});
        onPass && onPass();
    };

    const onChangeAnswer = (qid, val) => {
        // IMPORTANTE: usar clave computada [qid]
        setAnswers((prev) => ({ ...prev, [qid]: Number(val) }));
        // Si esta pregunta estaba marcada como incorrecta, limpiarla al cambiar respuesta
        setWrongIds((prev) => prev.filter((id) => id !== qid));
    };

    return (
        <form style={{ display: 'grid', gap: 20 }} onSubmit={onSubmit}>
            {items.map((q, idx) => {
                const isWrong = wrongIds.includes(q.id);

                const fieldsetStyle = {
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 16,
                    background: '#fff',
                    ...(isWrong
                        ? { borderColor: '#ef4444', background: '#fef2f2' }
                        : null)
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
                                        name={q.id}
                                        value={i}
                                        checked={String(answers[q.id]) === String(i)}
                                        onChange={(e) => onChangeAnswer(q.id, e.target.value)}
                                    />
                                    <span>{opt}</span>
                                </label>
                            ))}
                        </div>

                        {isWrong && (
                            <div
                                role="alert"
                                style={{ marginTop: 10, fontSize: 14, color: '#b91c1c' }}
                            >
                                {wrongLabel}
                            </div>
                        )}
                    </fieldset>
                );
            })}

            {formError && (
                <p style={{ color: '#b91c1c' }}>
                    {formError}
                </p>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
                {/* OJO: className bien escrito y sin llaves extra */}
                <button className="btn" type="submit">{checkLabel}</button>

                {formError && onRetry && (
                    <button className="btn btn-outline" type="button" onClick={onRetry}>
                        {retryLabel}
                    </button>
                )}
            </div>
        </form>
    );
}
