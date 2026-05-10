"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type SchoolClass = {
  id: string;
  name: string;
  school_year: number;
};

type Enrollment = {
  id: string;
  class_id: string;
  entry_term: number;
  status: "active" | "transferred" | "evaded";
  students: {
    full_name: string;
    registration_code: string | null;
  } | null;
  classes: {
    name: string;
    school_year: number;
  } | null;
};

type EnrollmentRow = Omit<Enrollment, "students" | "classes"> & {
  students: Enrollment["students"] | Enrollment["students"][];
  classes: Enrollment["classes"] | Enrollment["classes"][];
};

type StudentsPanelProps = {
  supabase: SupabaseClient;
};

export function StudentsPanel({ supabase }: StudentsPanelProps) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [studentName, setStudentName] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [entryTerm, setEntryTerm] = useState("1");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadStudentsData() {
      setIsLoading(true);
      const [classesResult, enrollmentsResult] = await Promise.all([
        supabase
          .from("classes")
          .select("id, name, school_year")
          .order("school_year", { ascending: false })
          .order("name"),
        supabase
          .from("enrollments")
          .select(
            "id, class_id, entry_term, status, students(full_name, registration_code), classes(name, school_year)"
          )
          .order("created_at", { ascending: false })
      ]);

      if (!isMounted) {
        return;
      }

      if (classesResult.error || enrollmentsResult.error) {
        setMessage("Nao foi possivel carregar alunos e matriculas.");
      } else {
        const availableClasses = classesResult.data ?? [];
        setClasses(availableClasses);
        setEnrollments(normalizeEnrollments(enrollmentsResult.data ?? []));
        if (!selectedClassId && availableClasses[0]) {
          setSelectedClassId(availableClasses[0].id);
        }
      }

      setIsLoading(false);
    }

    loadStudentsData();

    return () => {
      isMounted = false;
    };
  }, [selectedClassId, supabase]);

  async function handleCreateStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const fullName = studentName.trim();
    const parsedEntryTerm = Number(entryTerm);
    const selectedClass = classes.find((schoolClass) => schoolClass.id === selectedClassId);

    if (!fullName || !selectedClass || !Number.isInteger(parsedEntryTerm)) {
      setMessage("Informe aluno, turma e bimestre de entrada.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const { data: student, error: studentError } = await supabase
      .from("students")
      .insert({
        full_name: fullName,
        registration_code: registrationCode.trim() || null
      })
      .select("id")
      .single();

    if (studentError || !student) {
      setMessage("Nao foi possivel cadastrar o aluno.");
      setIsSaving(false);
      return;
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .insert({
        student_id: student.id,
        class_id: selectedClass.id,
        school_year: selectedClass.school_year,
        entry_term: parsedEntryTerm,
        status: "active"
      })
      .select(
        "id, class_id, entry_term, status, students(full_name, registration_code), classes(name, school_year)"
      )
      .single();

    if (enrollmentError || !enrollment) {
      setMessage("Aluno criado, mas nao foi possivel matricular na turma.");
    } else {
      setEnrollments((current) => [
        ...normalizeEnrollments([enrollment]),
        ...current
      ]);
      setStudentName("");
      setRegistrationCode("");
      setEntryTerm("1");
      setMessage("Aluno cadastrado e matriculado.");
    }

    setIsSaving(false);
  }

  const filteredEnrollments = enrollments.filter((enrollment) => {
    if (!selectedClassId) {
      return true;
    }

    return enrollment.class_id === selectedClassId;
  });

  return (
    <section className="admin-panel" aria-labelledby="students-title">
      <div className="section-heading">
        <p className="eyebrow">Alunos</p>
        <h2 id="students-title">Cadastro e matricula</h2>
        <p>Cadastre alunos e vincule cada um a turma correta para o ano letivo.</p>
      </div>

      <form className="management-card wide-card" onSubmit={handleCreateStudent}>
        <div className="inline-form-grid">
          <label>
            Nome do aluno
            <input
              onChange={(event) => setStudentName(event.target.value)}
              placeholder="Nome completo"
              value={studentName}
            />
          </label>

          <label>
            Codigo ou matricula
            <input
              onChange={(event) => setRegistrationCode(event.target.value)}
              placeholder="Opcional"
              value={registrationCode}
            />
          </label>

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
            Bimestre de entrada
            <select onChange={(event) => setEntryTerm(event.target.value)} value={entryTerm}>
              <option value="1">1o bimestre</option>
              <option value="2">2o bimestre</option>
              <option value="3">3o bimestre</option>
              <option value="4">4o bimestre</option>
            </select>
          </label>
        </div>

        <button className="primary-button" disabled={isSaving} type="submit">
          Cadastrar e matricular
        </button>
      </form>

      <div className="management-card wide-card">
        <h3>Alunos da turma selecionada</h3>
        <RecordList
          emptyText={isLoading ? "Carregando..." : "Nenhum aluno matriculado nesta turma."}
          items={filteredEnrollments.map((enrollment) => ({
            id: enrollment.id,
            title: enrollment.students?.full_name ?? "Aluno",
            detail: `${enrollment.classes?.name ?? "Turma"} - entrada no ${enrollment.entry_term}o bimestre`,
            status: enrollment.status
          }))}
        />
      </div>

      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}

function normalizeEnrollments(rows: EnrollmentRow[]): Enrollment[] {
  return rows.map((row) => ({
    ...row,
    students: Array.isArray(row.students) ? (row.students[0] ?? null) : row.students,
    classes: Array.isArray(row.classes) ? (row.classes[0] ?? null) : row.classes
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
    status: string;
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
          <small>{item.status}</small>
        </li>
      ))}
    </ul>
  );
}
