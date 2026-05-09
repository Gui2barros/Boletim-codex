"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Subject = {
  id: string;
  name: string;
};

type SchoolClass = {
  id: string;
  name: string;
  school_year: number;
};

type ClassSubject = {
  id: string;
  class_id: string;
  subject_id: string;
  classes: {
    name: string;
    school_year: number;
  } | null;
  subjects: {
    name: string;
  } | null;
};

type ClassSubjectRow = {
  id: string;
  class_id: string;
  subject_id: string;
  classes:
    | {
        name: string;
        school_year: number;
      }
    | Array<{
        name: string;
        school_year: number;
      }>
    | null;
  subjects:
    | {
        name: string;
      }
    | Array<{
        name: string;
      }>
    | null;
};

type AdminPanelProps = {
  supabase: SupabaseClient;
};

export function AdminPanel({ supabase }: AdminPanelProps) {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [className, setClassName] = useState("");
  const [schoolYear, setSchoolYear] = useState(String(currentYear));
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAdminData() {
      setIsLoading(true);
      const [subjectsResult, classesResult, classSubjectsResult] = await Promise.all([
        supabase.from("subjects").select("id, name").order("name"),
        supabase
          .from("classes")
          .select("id, name, school_year")
          .order("school_year", { ascending: false })
          .order("name"),
        supabase
          .from("class_subjects")
          .select("id, class_id, subject_id, classes(name, school_year), subjects(name)")
      ]);

      if (!isMounted) {
        return;
      }

      if (subjectsResult.error || classesResult.error || classSubjectsResult.error) {
        setMessage("Nao foi possivel carregar os cadastros administrativos.");
      } else {
        setSubjects(subjectsResult.data ?? []);
        setClasses(classesResult.data ?? []);
        setClassSubjects(normalizeClassSubjects(classSubjectsResult.data ?? []));
      }

      setIsLoading(false);
    }

    loadAdminData();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function handleCreateSubject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = subjectName.trim();

    if (!name) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("subjects")
      .insert({ name })
      .select("id, name")
      .single();

    if (error) {
      setMessage(error.message);
    } else if (data) {
      setSubjects((current) =>
        [...current, data].sort((left, right) => left.name.localeCompare(right.name))
      );
      setSubjectName("");
      setMessage("Disciplina cadastrada.");
    }

    setIsSaving(false);
  }

  async function handleCreateClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = className.trim();
    const parsedYear = Number(schoolYear);

    if (!name || !Number.isInteger(parsedYear)) {
      return;
    }

    setIsSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("classes")
      .insert({ name, school_year: parsedYear })
      .select("id, name, school_year")
      .single();

    if (error) {
      setMessage(error.message);
    } else if (data) {
      setClasses((current) =>
        [...current, data].sort((left, right) => {
          if (left.school_year !== right.school_year) {
            return right.school_year - left.school_year;
          }

          return left.name.localeCompare(right.name);
        })
      );
      setClassName("");
      setMessage("Turma cadastrada.");
      if (!selectedClassId) {
        setSelectedClassId(data.id);
      }
    }

    setIsSaving(false);
  }

  async function handleLinkSubject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedClassId || !selectedSubjectId) {
      setMessage("Selecione uma turma e uma disciplina.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("class_subjects")
      .insert({ class_id: selectedClassId, subject_id: selectedSubjectId })
      .select("id, class_id, subject_id, classes(name, school_year), subjects(name)")
      .single();

    if (error) {
      setMessage("Nao foi possivel vincular. Talvez essa disciplina ja esteja na turma.");
    } else if (data) {
      setClassSubjects((current) => [...current, ...normalizeClassSubjects([data])]);
      setSelectedSubjectId("");
      setMessage("Disciplina vinculada a turma.");
    }

    setIsSaving(false);
  }

  async function handleDeleteSubject(subjectId: string) {
    setIsSaving(true);
    setMessage("");

    const { error } = await supabase.from("subjects").delete().eq("id", subjectId);

    if (error) {
      setMessage("Nao foi possivel excluir. A disciplina pode estar vinculada a uma turma.");
    } else {
      setSubjects((current) => current.filter((subject) => subject.id !== subjectId));
      setClassSubjects((current) =>
        current.filter((classSubject) => classSubject.subject_id !== subjectId)
      );
      setMessage("Disciplina removida.");
    }

    setIsSaving(false);
  }

  async function handleDeleteClass(classId: string) {
    setIsSaving(true);
    setMessage("");

    const { error } = await supabase.from("classes").delete().eq("id", classId);

    if (error) {
      setMessage("Nao foi possivel excluir. A turma pode ter disciplinas ou alunos vinculados.");
    } else {
      setClasses((current) => current.filter((schoolClass) => schoolClass.id !== classId));
      setClassSubjects((current) =>
        current.filter((classSubject) => classSubject.class_id !== classId)
      );
      if (selectedClassId === classId) {
        setSelectedClassId("");
      }
      setMessage("Turma removida.");
    }

    setIsSaving(false);
  }

  async function handleDeleteClassSubject(classSubjectId: string) {
    setIsSaving(true);
    setMessage("");

    const { error } = await supabase.from("class_subjects").delete().eq("id", classSubjectId);

    if (error) {
      setMessage("Nao foi possivel remover o vinculo.");
    } else {
      setClassSubjects((current) =>
        current.filter((classSubject) => classSubject.id !== classSubjectId)
      );
      setMessage("Vinculo removido.");
    }

    setIsSaving(false);
  }

  const sortedClassSubjects = [...classSubjects].sort((left, right) => {
    const leftClass = `${left.classes?.school_year ?? ""} ${left.classes?.name ?? ""}`;
    const rightClass = `${right.classes?.school_year ?? ""} ${right.classes?.name ?? ""}`;

    if (leftClass !== rightClass) {
      return leftClass.localeCompare(rightClass);
    }

    return (left.subjects?.name ?? "").localeCompare(right.subjects?.name ?? "");
  });

  return (
    <section className="admin-panel" aria-labelledby="admin-title">
      <div className="section-heading">
        <p className="eyebrow">Administracao</p>
        <h2 id="admin-title">Cadastros iniciais</h2>
        <p>Comece criando as disciplinas e turmas que serao usadas nos lancamentos.</p>
      </div>

      <div className="admin-grid">
        <form className="management-card" onSubmit={handleCreateSubject}>
          <h3>Disciplinas</h3>
          <label>
            Nome da disciplina
            <input
              onChange={(event) => setSubjectName(event.target.value)}
              placeholder="Matematica"
              value={subjectName}
            />
          </label>
          <button className="primary-button" disabled={isSaving} type="submit">
            Adicionar disciplina
          </button>
          <RecordList
            emptyText={isLoading ? "Carregando..." : "Nenhuma disciplina cadastrada."}
            items={subjects.map((subject) => ({
              id: subject.id,
              title: subject.name,
              detail: "Disciplina",
              onDelete: () => handleDeleteSubject(subject.id)
            }))}
          />
        </form>

        <form className="management-card" onSubmit={handleCreateClass}>
          <h3>Turmas</h3>
          <label>
            Nome da turma
            <input
              onChange={(event) => setClassName(event.target.value)}
              placeholder="6o Ano A"
              value={className}
            />
          </label>
          <label>
            Ano letivo
            <input
              inputMode="numeric"
              max="2100"
              min="2000"
              onChange={(event) => setSchoolYear(event.target.value)}
              type="number"
              value={schoolYear}
            />
          </label>
          <button className="primary-button" disabled={isSaving} type="submit">
            Adicionar turma
          </button>
          <RecordList
            emptyText={isLoading ? "Carregando..." : "Nenhuma turma cadastrada."}
            items={classes.map((schoolClass) => ({
              id: schoolClass.id,
              title: schoolClass.name,
              detail: String(schoolClass.school_year),
              onDelete: () => handleDeleteClass(schoolClass.id)
            }))}
          />
        </form>
      </div>

      <form className="management-card wide-card" onSubmit={handleLinkSubject}>
        <h3>Disciplinas por turma</h3>
        <div className="inline-form-grid">
          <label>
            Turma
            <select
              onChange={(event) => setSelectedClassId(event.target.value)}
              value={selectedClassId}
            >
              <option value="">Selecione</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {schoolClass.name} - {schoolClass.school_year}
                </option>
              ))}
            </select>
          </label>

          <label>
            Disciplina
            <select
              onChange={(event) => setSelectedSubjectId(event.target.value)}
              value={selectedSubjectId}
            >
              <option value="">Selecione</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button className="primary-button" disabled={isSaving} type="submit">
          Vincular disciplina
        </button>

        <RecordList
          emptyText={isLoading ? "Carregando..." : "Nenhum vinculo cadastrado."}
          items={sortedClassSubjects.map((classSubject) => ({
            id: classSubject.id,
            title: `${classSubject.classes?.name ?? "Turma"} - ${
              classSubject.subjects?.name ?? "Disciplina"
            }`,
            detail: String(classSubject.classes?.school_year ?? ""),
            onDelete: () => handleDeleteClassSubject(classSubject.id)
          }))}
        />
      </form>

      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}

function normalizeClassSubjects(rows: ClassSubjectRow[]): ClassSubject[] {
  return rows.map((row) => ({
    ...row,
    classes: Array.isArray(row.classes) ? (row.classes[0] ?? null) : row.classes,
    subjects: Array.isArray(row.subjects) ? (row.subjects[0] ?? null) : row.subjects
  }));
}

function RecordList({
  emptyText,
  items
}: {
  emptyText: string;
  items: Array<{
    id: string;
    title: string;
    detail: string;
    onDelete: () => void;
  }>;
}) {
  if (items.length === 0) {
    return <p className="empty-state">{emptyText}</p>;
  }

  return (
    <ul className="record-list">
      {items.map((item) => (
        <li key={item.id}>
          <span>
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
          </span>
          <button className="text-button" type="button" onClick={item.onDelete}>
            Excluir
          </button>
        </li>
      ))}
    </ul>
  );
}
