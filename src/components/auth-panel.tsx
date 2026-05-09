"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";
type UserProfile = {
  full_name: string | null;
  role: "admin" | "professor";
};

export function AuthPanel() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(supabase));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (!currentSession) {
        setProfile(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session?.user) {
      return;
    }

    let isMounted = true;

    supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          setMessage("Nao foi possivel carregar o perfil deste usuario.");
          return;
        }

        setProfile(data);
      });

    return () => {
      isMounted = false;
    };
  }, [session?.user, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      return;
    }

    setMessage("");
    setIsSubmitting(true);

    const credentials = {
      email: email.trim(),
      password
    };

    const { error } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);

    if (error) {
      setMessage(error.message);
    } else if (mode === "sign-up") {
      setMessage("Cadastro criado. Verifique seu e-mail se o Supabase pedir confirmacao.");
    } else {
      setMessage("Acesso realizado com sucesso.");
    }

    setIsSubmitting(false);
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    setMessage("");
    await supabase.auth.signOut();
    setProfile(null);
    setPassword("");
  }

  if (isLoading) {
    return <div className="auth-panel">Carregando acesso...</div>;
  }

  if (!supabase) {
    return (
      <section className="auth-panel" aria-labelledby="config-title">
        <div className="auth-header">
          <p className="eyebrow">Configuracao pendente</p>
          <h2 id="config-title">Supabase ainda nao configurado</h2>
          <p>
            Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
            no ambiente para liberar o login.
          </p>
        </div>
      </section>
    );
  }

  if (session?.user) {
    return (
      <section className="auth-panel" aria-labelledby="dashboard-title">
        <div className="auth-header">
          <p className="eyebrow">Acesso conectado</p>
          <h2 id="dashboard-title">Painel inicial</h2>
          <p>
            Voce entrou como <strong>{profile?.full_name ?? session.user.email}</strong>.
            {profile ? ` Perfil atual: ${profile.role}.` : " Carregando perfil..."}
          </p>
        </div>

        <div className="dashboard-grid">
          <article>
            <span>01</span>
            <h3>Perfis</h3>
            <p>Separar usuarios entre administracao e professores.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Cadastros</h3>
            <p>Registrar turmas, disciplinas, alunos e vinculos.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Lancamentos</h3>
            <p>Permitir notas, faltas e observacoes por bimestre.</p>
          </article>
        </div>

        <button className="secondary-button" type="button" onClick={handleSignOut}>
          Sair
        </button>
      </section>
    );
  }

  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <div className="auth-header">
        <p className="eyebrow">Supabase conectado</p>
        <h2 id="auth-title">Entrar no sistema</h2>
        <p>
          Use um e-mail e senha para acessar. Por enquanto, este login valida a
          conexao entre o app, a Vercel e o Supabase.
        </p>
      </div>

      <div className="auth-toggle" aria-label="Tipo de acesso">
        <button
          className={mode === "sign-in" ? "active" : ""}
          type="button"
          onClick={() => setMode("sign-in")}
        >
          Entrar
        </button>
        <button
          className={mode === "sign-up" ? "active" : ""}
          type="button"
          onClick={() => setMode("sign-up")}
        >
          Criar acesso
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          E-mail
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="professor@escola.com"
            required
            type="email"
            value={email}
          />
        </label>

        <label>
          Senha
          <input
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimo de 6 caracteres"
            required
            type="password"
            value={password}
          />
        </label>

        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Enviando..." : mode === "sign-in" ? "Entrar" : "Criar acesso"}
        </button>
      </form>

      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}
