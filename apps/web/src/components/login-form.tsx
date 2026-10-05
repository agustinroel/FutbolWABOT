'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import { ArrowUpRight, LockKeyhole, Trophy } from 'lucide-react';

export function LoginForm(): ReactElement {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || 'No se pudo iniciar sesión.');
      }
      window.location.reload();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se pudo iniciar sesión.'
      );
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark">
          <Trophy size={24} strokeWidth={1.8} />
        </div>
        <span className="eyebrow">ALICANTE · DESDE EL 20</span>
        <h1>
          El jueves
          <br />
          <em>se juega.</em>
        </h1>
        <p>
          La pizarra privada del grupo Montemar. Convocatorias, resultados y la
          historia que vamos escribiendo juntos.
        </p>
        <form className="login-form" onSubmit={(event) => void submit(event)}>
          <label htmlFor="dashboard-password">Acceso privado</label>
          <div className="password-field">
            <LockKeyhole size={17} />
            <input
              id="dashboard-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Introduce la contraseña"
              required
            />
          </div>
          <button
            className="button button-primary"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Entrando…' : 'Entrar al vestuario'}
            <ArrowUpRight size={17} />
          </button>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
        <span className="login-footnote">
          ACCESO RESERVADO AL GRUPO <span>·</span> MONTEMAR, ALICANTE
        </span>
      </section>
      <aside
        className="login-art"
        aria-label="Ilustración de un campo de fútbol"
      >
        <div className="field-lines">
          <span />
          <i />
          <b />
        </div>
        <div className="art-caption">
          <span>01 / 04</span>
          <strong>
            UN EQUIPO.
            <br />
            UN JUEVES.
            <br />
            <em>UNA HISTORIA.</em>
          </strong>
        </div>
        <div className="art-stamp">
          M<br />
          <small>CF</small>
        </div>
      </aside>
    </main>
  );
}
