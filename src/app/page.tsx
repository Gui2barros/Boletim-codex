const nextSteps = [
  "Configurar Supabase",
  "Criar login de administradores e professores",
  "Cadastrar turmas, disciplinas e alunos",
  "Lançar notas e frequência",
  "Gerar boletins em PDF"
];

export default function Home() {
  return (
    <main className="page-shell">
      <section className="intro">
        <p className="eyebrow">Boletim Codex</p>
        <h1>Sistema web para notas, frequência e boletins escolares.</h1>
        <p className="summary">
          Base inicial do projeto pronta para GitHub, Vercel e Supabase. A
          próxima etapa é conectar autenticação e permissões.
        </p>
      </section>

      <section className="panel" aria-labelledby="next-steps-title">
        <h2 id="next-steps-title">Próximas etapas</h2>
        <ol>
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
