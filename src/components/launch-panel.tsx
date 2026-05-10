"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type ClassSubject = {
  id: string;
  class_id: string;
  classes: { name: string; school_year: number } | null;
  subjects: { name: string } | null;
};

type ClassSubjectRow = {
  id: string;
  class_id: string;
  classes: ClassSubject["classes"] | ClassSubject["classes"][];
  subjects: ClassSubject["subjects"] | ClassSubject["subjects"][];
};

type Enrollment = {
  id: string;
  class_id: string;
  entry_term: number;
  exit_term: number | null;
  status: "active" | "transferred" | "evaded";
  students: { full_name: string; registration_code: string | null } | null;
};

type EnrollmentRow = Omit<Enrollment, "students"> & {
  students: Enrollment["students"] | Enrollment["students"][];
};

type TermRecord = {
  id: string;
  enrollment_id: string;
  grade: number | null;
  absences: number;
  observation: string | null;
};

type LaunchDraft = {
  grade: string;
  absences: string;
  observation: string;
};

type LaunchPanelProps = {
  role: "admin" | "professor";
  supabase: SupabaseClient;
  userId: string;
};

type TeacherAssignmentSubjectRow = {
  class_subject_id: string;
};

export function LaunchPanel({ role, supabase, userId }: LaunchPanelProps) {
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [drafts, setDrafts] = useState<Record<string, LaunchDraft>>({});
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState("");
  const [term, setTerm] = useState("1");
  const [plannedLessons, setPlannedLessons] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectedClassSubject = classSubjects.find(
    (classSubject) => classSubject.id === selectedClassSubjectId
  );

  useEffect(() => {
    let isMounted = true;

    async function loadOptions() {
      setIsLoading(true);
      const [classSubjectsResult, assignmentsResult] = await Promise.all([
        supabase
          .from("class_subjects")
          .select("id, class_id, classes(name, school_year), subjects(name)"),
        role === "professor"
          ? supabase
              .from("teacher_assignments")
              .select("class_subject_id")
              .eq("teacher_id", userId)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (!isMounted) {
        return;
      }

      if (classSubjectsResult.error || assignmentsResult.error) {
        setMessage("Nao foi possivel carregar turmas e disciplinas.");
      } else {
        const allowedClassSubjectIds =
          role === "professor"
            ? new Set(
                (assignmentsResult.data ?? []).map(
                  (assignment: TeacherAssignmentSubjectRow) => assignment.class_subject_id
                )
              )
            : null;
        const options = normalizeClassSubjects(classSubjectsResult.data ?? [])
          .filter((classSubject) =>
            role === "professor" ? allowedClassSubjectIds?.has(classSubject.id) : true
          )
          .sort((left, right) =>
            formatClassSubject(left).localeCompare(formatClassSubject(right))
          );
        setClassSubjects(options);
        if (!selectedClassSubjectId && options[0]) {
          setSelectedClassSubjectId(options[0].id);
        }
      }

      setIsLoading(false);
    }

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, [role, selectedClassSubjectId, supabase, userId]);

  useEffect(() => {
    if (!selectedClassSubject) {
      return;
    }

    let isMounted = true;
    const currentClassSubject = selectedClassSubject;

    async function loadLaunchData() {
      setIsLoading(true);
      const parsedTerm = Number(term);
      const [enrollmentsResult, settingsResult, recordsResult] = await Promise.all([
        supabase
          .from("enrollments")
          .select("id, class_id, entry_term, exit_term, status, students(full_name, registration_code)")
          .eq("class_id", currentClassSubject.class_id)
          .order("created_at"),
        supabase
          .from("term_settings")
          .select("planned_lessons")
          .eq("class_subject_id", currentClassSubject.id)
          .eq("term", parsedTerm)
          .maybeSingle(),
        supabase
          .from("term_records")
          .select("id, enrollment_id, grade, absences, observation")
          .eq("class_subject_id", currentClassSubject.id)
          .eq("term", parsedTerm)
      ]);

      if (!isMounted) {
        return;
      }

      if (enrollmentsResult.error || settingsResult.error || recordsResult.error) {
        setMessage("Nao foi possivel carregar os lancamentos.");
      } else {
        const normalizedEnrollments = normalizeEnrollments(enrollmentsResult.data ?? []);
        const loadedRecords = recordsResult.data ?? [];
        setEnrollments(normalizedEnrollments);
        setPlannedLessons(
          settingsResult.data?.planned_lessons
            ? String(settingsResult.data.planned_lessons)
            : ""
        );
        setDrafts(createDrafts(normalizedEnrollments, loadedRecords));
      }

      setIsLoading(false);
    }

    loadLaunchData();

    return () => {
      isMounted = false;
    };
  }, [selectedClassSubject, supabase, term]);

  function updateDraft(enrollmentId: string, field: keyof LaunchDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [enrollmentId]: {
        ...(current[enrollmentId] ?? { grade: "", absences: "0", observation: "" }),
        [field]: value
      }
    }));
  }

  async function handleSaveLaunches(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedClassSubject) {
      setMessage("Selecione turma e disciplina.");
      return;
    }

    const parsedTerm = Number(term);
    const parsedLessons = Number(plannedLessons);

    if (!Number.isInteger(parsedLessons) || parsedLessons <= 0) {
      setMessage("Informe a quantidade prevista de aulas.");
      return;
    }

    const rows = enrollments
      .filter((enrollment) => canReceiveLaunch(enrollment, parsedTerm))
      .map((enrollment) => {
        const draft = drafts[enrollment.id] ?? {
          grade: "",
          absences: "0",
          observation: ""
        };
        const grade = draft.grade.trim() === "" ? null : Number(draft.grade);
        const absences = Number(draft.absences || "0");

        return {
          enrollment_id: enrollment.id,
          class_subject_id: selectedClassSubject.id,
          term: parsedTerm,
          grade,
          absences,
          observation: draft.observation.trim() || null
        };
      });

    const hasInvalidRow = rows.some(
      (row) =>
        (row.grade !== null && (Number.isNaN(row.grade) || row.grade < 0 || row.grade > 10)) ||
        !Number.isInteger(row.absences) ||
        row.absences < 0
    );

    if (hasInvalidRow) {
      setMessage("Confira notas entre 0 e 10 e faltas sem valores negativos.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const [settingsResult, recordsResult] = await Promise.all([
      supabase.from("term_settings").upsert(
        {
          class_subject_id: selectedClassSubject.id,
          term: parsedTerm,
          planned_lessons: parsedLessons
        },
        { onConflict: "class_subject_id,term" }
      ),
      supabase
        .from("term_records")
        .upsert(rows, { onConflict: "enrollment_id,class_subject_id,term" })
        .select("id, enrollment_id, grade, absences, observation")
    ]);

    if (settingsResult.error || recordsResult.error) {
      setMessage("Nao foi possivel salvar os lancamentos.");
    } else {
      setMessage("Lancamentos salvos.");
    }

    setIsSaving(false);
  }

  const parsedTerm = Number(term);
  const parsedLessons = Number(plannedLessons);
  const visibleEnrollments = useMemo(
    () => [...enrollments].sort((left, right) => getStudentName(left).localeCompare(getStudentName(right))),
    [enrollments]
  );

  return (
    <section className="admin-panel" aria-labelledby="launch-title">
      <div className="section-heading">
        <p className="eyebrow">Lancamentos</p>
        <h2 id="launch-title">Notas e frequencia</h2>
        <p>Selecione turma, disciplina e bimestre para registrar notas, faltas e observacoes.</p>
      </div>

      <form className="management-card wide-card" onSubmit={handleSaveLaunches}>
        <div className="inline-form-grid three-columns">
          <label>
            Turma e disciplina
            <select
              onChange={(event) => setSelectedClassSubjectId(event.target.value)}
              value={selectedClassSubjectId}
            >
              <option value="">Selecione</option>
              {classSubjects.map((classSubject) => (
                <option key={classSubject.id} value={classSubject.id}>
                  {formatClassSubject(classSubject)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Bimestre
            <select onChange={(event) => setTerm(event.target.value)} value={term}>
              <option value="1">1o bimestre</option>
              <option value="2">2o bimestre</option>
              <option value="3">3o bimestre</option>
              <option value="4">4o bimestre</option>
            </select>
          </label>

          <label>
            Aulas previstas
            <input
              inputMode="numeric"
              min="1"
              onChange={(event) => setPlannedLessons(event.target.value)}
              type="number"
              value={plannedLessons}
            />
          </label>
        </div>

        <div className="launch-list">
          {isLoading ? <p className="empty-state">Carregando...</p> : null}
          {!isLoading && visibleEnrollments.length === 0 ? (
            <p className="empty-state">Nenhum aluno matriculado nesta turma.</p>
          ) : null}
          {visibleEnrollments.map((enrollment) => {
            const draft = drafts[enrollment.id] ?? {
              grade: "",
              absences: "0",
              observation: ""
            };
            const isSpecial = !canReceiveLaunch(enrollment, parsedTerm);
            const frequency = calculateFrequency(parsedLessons, Number(draft.absences || "0"));

            return (
              <article className={isSpecial ? "launch-row special-row" : "launch-row"} key={enrollment.id}>
                <div className="launch-student">
                  <strong>{getStudentName(enrollment)}</strong>
                  <small>{getEnrollmentLabel(enrollment, parsedTerm)}</small>
                </div>

                <label>
                  Nota
                  <input
                    disabled={isSpecial}
                    inputMode="decimal"
                    max="10"
                    min="0"
                    onChange={(event) => updateDraft(enrollment.id, "grade", event.target.value)}
                    step="0.01"
                    type="number"
                    value={draft.grade}
                  />
                </label>

                <label>
                  Faltas
                  <input
                    disabled={isSpecial}
                    inputMode="numeric"
                    min="0"
                    onChange={(event) => updateDraft(enrollment.id, "absences", event.target.value)}
                    type="number"
                    value={draft.absences}
                  />
                </label>

                <label>
                  Observacao
                  <input
                    disabled={isSpecial}
                    onChange={(event) =>
                      updateDraft(enrollment.id, "observation", event.target.value)
                    }
                    value={draft.observation}
                  />
                </label>

                <div className="frequency-box">
                  <span>Frequencia</span>
                  <strong>{frequency}</strong>
                </div>
              </article>
            );
          })}
        </div>

        <button className="primary-button" disabled={isSaving} type="submit">
          Salvar lancamentos
        </button>
      </form>

      {message ? <p className="form-message">{message}</p> : null}
    </section>
  );
}

function createDrafts(enrollments: Enrollment[], records: TermRecord[]) {
  return enrollments.reduce<Record<string, LaunchDraft>>((accumulator, enrollment) => {
    const record = records.find((current) => current.enrollment_id === enrollment.id);
    accumulator[enrollment.id] = {
      grade: record?.grade === null || record?.grade === undefined ? "" : String(record.grade),
      absences: record?.absences === undefined ? "0" : String(record.absences),
      observation: record?.observation ?? ""
    };
    return accumulator;
  }, {});
}

function normalizeClassSubjects(rows: ClassSubjectRow[]): ClassSubject[] {
  return rows.map((row) => ({
    id: row.id,
    class_id: row.class_id,
    classes: Array.isArray(row.classes) ? (row.classes[0] ?? null) : row.classes,
    subjects: Array.isArray(row.subjects) ? (row.subjects[0] ?? null) : row.subjects
  }));
}

function normalizeEnrollments(rows: EnrollmentRow[]): Enrollment[] {
  return rows.map((row) => ({
    ...row,
    students: Array.isArray(row.students) ? (row.students[0] ?? null) : row.students
  }));
}

function formatClassSubject(classSubject: ClassSubject) {
  const className = classSubject.classes?.name ?? "Turma";
  const subjectName = classSubject.subjects?.name ?? "Disciplina";
  const schoolYear = classSubject.classes?.school_year;

  return `${className} - ${subjectName}${schoolYear ? ` (${schoolYear})` : ""}`;
}

function getStudentName(enrollment: Enrollment) {
  return enrollment.students?.full_name ?? "Aluno";
}

function canReceiveLaunch(enrollment: Enrollment, term: number) {
  if (term < enrollment.entry_term) {
    return false;
  }

  if (enrollment.status !== "active" && enrollment.exit_term && term > enrollment.exit_term) {
    return false;
  }

  return true;
}

function getEnrollmentLabel(enrollment: Enrollment, term: number) {
  if (term < enrollment.entry_term) {
    return "ENT";
  }

  if (enrollment.status === "transferred" && enrollment.exit_term && term > enrollment.exit_term) {
    return "TR";
  }

  if (enrollment.status === "evaded" && enrollment.exit_term && term > enrollment.exit_term) {
    return "EV";
  }

  return enrollment.students?.registration_code
    ? `Matricula ${enrollment.students.registration_code}`
    : "Ativo";
}

function calculateFrequency(plannedLessons: number, absences: number) {
  if (!Number.isFinite(plannedLessons) || plannedLessons <= 0 || !Number.isFinite(absences)) {
    return "-";
  }

  const percentage = Math.max(0, ((plannedLessons - absences) / plannedLessons) * 100);
  return `${percentage.toFixed(1)}%`;
}
