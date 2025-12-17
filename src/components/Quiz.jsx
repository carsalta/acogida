
// src/components/Quiz.jsx
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
    const [answers, setAnswers] = useState({});     // respuestas seleccionadas por pregunta
    const [formError, setFormError] = useState(null); // mensaje global
    const [wrongIds, setWrongIds] = useState([]);     // ids de preguntas incorrectas
    const qRefs = useRef({});                         // refs por pregunta para hacer scroll

    const onSubmit = (e) => {
        e.preventDefault();

        const wrong = [];
        for (const q of items) {
            const qid = q.id ?? String(q.text ?? '');
            const a = answers[qid];
            const expected = Number(q.correct);          // tus JSON usan índice correcto (0/1/2/3)
            const ok = a !== undefined && Number(a) === expected;
            if (!ok) wrong.push(qid);
        }

        if (wrong.length) {
            setWrongIds(wrong);
            setFormError(`${wrongLabel} (${wrong.length}/${items.length})`);
            logEvent('quiz_fail', { wrongCount: wrong.length });

            // Scroll a la primera incorrecta
            const firstWrongRef = qRefs.current[wrong[0]];
            if (firstWrongRef?.scrollIntoView) {
                firstWrongRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // Todo correcto
        setWrongIds([]);
        setFormError(null);
        logEvent('quiz_pass', {});
        onPass && onPass(); // <- dispara la descarga del certificado en App.jsx
    };

    const onChangeAnswer = (qid, val) => {
        // clave computada [qid]
        setAnswers((prev) => ({ ...prev, [qid]: Number(val) }));
        // si estaba marcada como incorrecta, limpiar al cambiar respuesta
        setWrongIds((prev) => prev.filter((id) => id !== qid));
    };

    return (
        <form style={{ display: 'grid', gap: 20 }} onSubmit={onSubmit} noValidate>
            {items.map((q, idx) => {
                const qid = q.id ?? String(idx + 1);
                const isWrong = wrongIds.includes(qid);

                const fieldsetStyle = {
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 16,
                    background: '#fff',
                    ...(isWrong ? { borderColor: '#ef4444', background: '#fef2f2' } : null)
                };

                const legendStyle = {
                    fontWeight: 600,
                    color: isWrong ? '#b91c1c' : '#0f172a'
                };

                return (
                    <fieldset
                        key={qid}
                        ref={(el) => { qRefs.current[qid] = el; }}
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
                                        name={`q-${qid}`}            // agrupa por pregunta
                                        value={i}
                                        checked={Number(answers[qid]) === i}
                                        onChange={(e) => onChangeAnswer(qid, e.target.value)}
                                        required
                                    />
                                    <span>{typeof opt === 'string' ? opt : (opt?.text ?? opt?.label ?? String(opt))}</span>
                                </label>
                            ))}
                        </div>

                        {isWrong && (
                            <div role="alert" style={{ marginTop: 10, fontSize: 14, color: '#b91c1c' }}>
                                {wrongLabel}
                            </div>
                        )}
                    </fieldset>
                );
            })}

            {formError && (
                <p role="alert" style={{ color: '#b91c1c' }}>
                    {formError}
                </p>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
                {/* Botón principal: submit */}
                <button className="btn" type="submit">
                    {checkLabel}
                </button>

                {/* Botón de retry (opcional) cuando hay errores */}
                {formError && onRetry && (
                    <button className="btn btn-outline" type="button" onClick={onRetry} title={retryLabel}>
                        {retryLabel}
                    </button>
                )}
            </div>
        </form>
    );
}