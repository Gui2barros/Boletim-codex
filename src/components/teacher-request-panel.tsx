"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type ClassSubject = {
  id: string;
  classes: { name: string; school_year: number } | null;
  subjects: { name: string } | null;
};

type ClassSubjectRow = {
  id: string;
  classes: ClassSubject["classes"] | ClassSubject["classes"][];
  subjects: ClassSubject["subjects"] | ClassSubject["subjects"][];
};

type RequestRow = {
  id: string;
  class_subject_id: string;
  status: "pending" | "approved" | "rejected";
  class_subjects:
    | {
        classes: ClassSubjectRow["classes"];
        subjects: ClassSubjectRow["subjects"];
      }
    | Array<{
        classes: ClassSubjectRow["classes"];
        subjects: ClassSubjectRow["subjects"];
      }>
    | null;
};

type AssignmentRequest = {
  id: string;
  class_subject_id: string;
  status: "pending" | "approved" | "rejected";
  class_subjects: ClassSubject | null;
};

type TeacherRequestPanelProps = {
  supabase: SupabaseClient;
  userId: string;
};

export function TeacherRequestPanel({ supabase, userId }: TeacherRequestPanelProps) {
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [requests, setRequests] = useState<AssignmentRequest[]>([]);
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadRequestData() {
      setIsLoading(true);
      const [classSubjectsResult, requestsResult] = await Promise.all([
        supabase
          .from("class_subjects")
          .select("id, classes(name, school_year), subjects(name)"),
        supabase
          .from("teacher_assignment_requests")
          .select(
            "id, class_subject_id, status, class_subjects(classes(name, school_year), subjects(name))"
          )
          .eq("teacher_id", userId)
      ]);

      if (!isMounted) {
        return;
      }

      if (classSubjectsResult.error || requestsResult.error) {
        setMessage("Nao foi possivel carregar as opcoes de solicitacao.");
      } else {
        setClassSubjects(normalizeClassSubjects(classSubjectsResult.data ?? []));
        setRequests(normalizeRequests(requestsResult.data ?? []));
      }

      setIsLoading(false);
    }

    loadRequestData();

    return () => {
      isMounted = false;
    };
  }, [supabase, userId]);

  async function handleCreateRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedClassSubjectId) {
      setMessage("Selecione uma turma/disciplina.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("teacher_assignment_requests")
      .insert({
        teacher_id: userId,
        class_subject_id: selectedClassSubjectId
      })
      .select(
        "id, class_subject_id, status, class_subjects(classes(name, school_year), subjects(name))"
      )
      .single();

    if (error) {
      setMessage("Nao foi possivel solicitar. Talvez ja exista uma solicitacao para essa turma.");
    } else if (data) {
      setRequests((current) => [...normalizeRequests([data]), ...current]);
      setSelectedClassSubjectId("");
      setMessage("Solicitacao enviada para aprovacao.");
    }

    setIsSaving(false);
  }

  const requestedIds = new Set(requests.map((request) => request.class_subject_id));
  const sortedClassSubjects = [...classSubjects].sort((left, right) =>
    formatClassSubject(left).localeCompare(formatClassSubject(right))
  );

  return (
    <section className="admin-panel" aria-labelledby="request-title">
      <div className="section-heading">
        <p className="eyebrow">Solicitacao</p>
        <h2 id="request-title">Pedir acesso a turma</h2>
        <p>Escolha a turma e disciplina que voce precisa acessar. O admin aprova depois.</p>
      </div>

      <form className="management-card wide-card" onSubmit={handleCreateRequest}>
        <label>
          Turma e disciplina
          <select
            onChange={(event) => setSelectedClassSubjectId(event.target.value)}
            value={selectedClassSubjectId}
          >
            <option value="">Selecione</option>
            {sortedClassSubjects.map((classSubject) => {
              const isRequested = requestedIds.has(classSubject.id);

              return (
                <option disabled={isRequested} key={classSubject.id} value={classSubject.id}>
                  {formatClassSubject(classSubject)}
                  {isRequested ? " - ja solicitado" : ""}
                </option>
              );
            })}
          </select>
        </label>

        <button className="primary-button" disabled={isSaving} type="submit">
          Enviar solicitacao
        </button>
      </form>

      <div className="management-card wide-card">
        <h3>Minhas solicitacoes</h3>
        {requests.length === 0 ? (
          <p className="empty-state">
            {isLoading ? "Carregando..." : "Nenhuma solicitacao enviada."}
          </p>
        ) : (
          <ul className="record-list">
            {requests.map((request) => (
              <li key={request.id}>
                <span>
                  <strong>{formatClassSubject(request.class_subjects)}</strong>
                  <small>{formatStatus(request.status)}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}

function normalizeClassSubjects(rows: ClassSubjectRow[]): ClassSubject[] {
  return rows.map((row) => ({
    id: row.id,
    classes: Array.isArray(row.classes) ? (row.classes[0] ?? null) : row.classes,
    subjects: Array.isArray(row.subjects) ? (row.subjects[0] ?? null) : row.subjects
  }));
}

function normalizeRequests(rows: RequestRow[]): AssignmentRequest[] {
  return rows.map((row) => {
    const classSubject = Array.isArray(row.class_subjects)
      ? (row.class_subjects[0] ?? null)
      : row.class_subjects;

    return {
      id: row.id,
      class_subject_id: row.class_subject_id,
      status: row.status,
      class_subjects: classSubject
        ? {
            id: row.class_subject_id,
            classes: Array.isArray(classSubject.classes)
              ? (classSubject.classes[0] ?? null)
              : classSubject.classes,
            subjects: Array.isArray(classSubject.subjects)
              ? (classSubject.subjects[0] ?? null)
              : classSubject.subjects
          }
        : null
    };
  });
}

function formatClassSubject(classSubject: ClassSubject | null) {
  const className = classSubject?.classes?.name ?? "Turma";
  const subjectName = classSubject?.subjects?.name ?? "Disciplina";
  const schoolYear = classSubject?.classes?.school_year;

  return `${className} - ${subjectName}${schoolYear ? ` (${schoolYear})` : ""}`;
}

function formatStatus(status: AssignmentRequest["status"]) {
  if (status === "approved") {
    return "Aprovada";
  }

  if (status === "rejected") {
    return "Recusada";
  }

  return "Pendente";
}
