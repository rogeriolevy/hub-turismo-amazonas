"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="container prose">
      <h1>Não foi possível abrir esta página.</h1>
      <p>Tente novamente em instantes.</p>
      <button className="button button-dark" onClick={reset}>
        Tentar novamente
      </button>
    </main>
  );
}
