import { AuthPanel } from "@/components/auth-panel";

const nextSteps = [
  "Criar perfis de administrador e professor",
  "Cadastrar turmas, disciplinas e alunos",
  "Lancar notas e frequencia",
  "Gerar boletins em PDF"
];

export default function Home() {
  return (
    <main className="page-shell">
      <section className="intro">
        <p className="eyebrow">Boletim Codex</p>
        <h1>Sistema web para notas, frequencia e boletins escolares.</h1>
        <p className="summary">
          Base online conectada ao GitHub, Vercel e Supabase. Agora estamos
          validando o acesso dos usuarios antes de criar os cadastros.
        </p>
      </section>

      <AuthPanel />

      <section className="panel" aria-labelledby="next-steps-title">
        <h2 id="next-steps-title">Proximas etapas</h2>
        <ol>
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}
