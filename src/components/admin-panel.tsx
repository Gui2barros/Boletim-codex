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

type TeacherProfile = {
  id: string;
  full_name: string | null;
};

type TeacherAssignment = {
  id: string;
  teacher_id: string;
  class_subject_id: string;
  profiles: {
    full_name: string | null;
  } | null;
  class_subjects: {
    classes: {
      name: string;
      school_year: number;
    } | null;
    subjects: {
      name: string;
    } | null;
  } | null;
};

type TeacherAssignmentRow = Omit<TeacherAssignment, "profiles" | "class_subjects"> & {
  profiles: TeacherAssignment["profiles"] | TeacherAssignment["profiles"][];
  class_subjects:
    | {
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
      }
    | Array<{
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
      }>
    | null;
};

type AssignmentRequest = {
  id: string;
  teacher_id: string;
  class_subject_id: string;
  status: "pending" | "approved" | "rejected";
  profiles: {
    full_name: string | null;
  } | null;
  class_subjects: TeacherAssignment["class_subjects"];
};

type AssignmentRequestRow = Omit<AssignmentRequest, "profiles" | "class_subjects"> & {
  profiles: TeacherAssignmentRow["profiles"];
  class_subjects: TeacherAssignmentRow["class_subjects"];
};

type AdminPanelProps = {
  supabase: SupabaseClient;
};

export function AdminPanel({ supabase }: AdminPanelProps) {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [assignmentRequests, setAssignmentRequests] = useState<AssignmentRequest[]>([]);
  const [subjectName, setSubjectName] = useState("");
  const [className, setClassName] = useState("");
  const [schoolYear, setSchoolYear] = useState(String(currentYear));
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [sourceClassId, setSourceClassId] = useState("");
  const [duplicateClassName, setDuplicateClassName] = useState("");
  const [duplicateSchoolYear, setDuplicateSchoolYear] = useState(String(currentYear));
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedAssignmentClassSubjectId, setSelectedAssignmentClassSubjectId] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadAdminData() {
      setIsLoading(true);
      const [
        subjectsResult,
        classesResult,
        classSubjectsResult,
        teachersResult,
        teacherAssignmentsResult,
        assignmentRequestsResult
      ] = await Promise.all([
        supabase.from("subjects").select("id, name").order("name"),
        supabase
          .from("classes")
          .select("id, name, school_year")
          .order("school_year", { ascending: false })
          .order("name"),
        supabase
          .from("class_subjects")
          .select("id, class_id, subject_id, classes(name, school_year), subjects(name)"),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "professor")
          .order("full_name"),
        supabase
          .from("teacher_assignments")
          .select(
            "id, teacher_id, class_subject_id, profiles(full_name), class_subjects(classes(name, school_year), subjects(name))"
          ),
        supabase
          .from("teacher_assignment_requests")
          .select(
            "id, teacher_id, class_subject_id, status, profiles(full_name), class_subjects(classes(name, school_year), subjects(name))"
          )
      ]);

      if (!isMounted) {
        return;
      }

      if (
        subjectsResult.error ||
        classesResult.error ||
        classSubjectsResult.error ||
        teachersResult.error ||
        teacherAssignmentsResult.error ||
        assignmentRequestsResult.error
      ) {
        setMessage("Nao foi possivel carregar os cadastros administrativos.");
      } else {
        setSubjects(subjectsResult.data ?? []);
        setClasses(classesResult.data ?? []);
        setClassSubjects(normalizeClassSubjects(classSubjectsResult.data ?? []));
        setTeachers(teachersResult.data ?? []);
        setTeacherAssignments(
          normalizeTeacherAssignments(teacherAssignmentsResult.data ?? [])
        );
        setAssignmentRequests(normalizeAssignmentRequests(assignmentRequestsResult.data ?? []));
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

  async function handleDuplicateClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = duplicateClassName.trim();
    const parsedYear = Number(duplicateSchoolYear);

    if (!sourceClassId || !name || !Number.isInteger(parsedYear)) {
      setMessage("Selecione uma turma origem, informe o novo nome e o ano letivo.");
      return;
    }

    const sourceSubjects = classSubjects.filter(
      (classSubject) => classSubject.class_id === sourceClassId
    );

    setIsSaving(true);
    setMessage("");

    const { data: newClass, error: classError } = await supabase
      .from("classes")
      .insert({ name, school_year: parsedYear })
      .select("id, name, school_year")
      .single();

    if (classError || !newClass) {
      setMessage("Nao foi possivel duplicar a turma. Verifique se o nome ja existe neste ano.");
      setIsSaving(false);
      return;
    }

    setClasses((current) =>
      [...current, newClass].sort((left, right) => {
        if (left.school_year !== right.school_year) {
          return right.school_year - left.school_year;
        }

        return left.name.localeCompare(right.name);
      })
    );

    if (sourceSubjects.length === 0) {
      setDuplicateClassName("");
      setSelectedClassId(newClass.id);
      setSourceClassId("");
      setMessage("Turma duplicada sem disciplinas, pois a origem nao tinha vinculos.");
      setIsSaving(false);
      return;
    }

    const { data: copiedLinks, error: linksError } = await supabase
      .from("class_subjects")
      .insert(
        sourceSubjects.map((classSubject) => ({
          class_id: newClass.id,
          subject_id: classSubject.subject_id
        }))
      )
      .select("id, class_id, subject_id, classes(name, school_year), subjects(name)");

    if (linksError) {
      setMessage("Turma criada, mas nao foi possivel copiar todas as disciplinas.");
    } else {
      setClassSubjects((current) => [
        ...current,
        ...normalizeClassSubjects(copiedLinks ?? [])
      ]);
      setDuplicateClassName("");
      setSelectedClassId(newClass.id);
      setSourceClassId("");
      setMessage(`Turma duplicada com ${sourceSubjects.length} disciplina(s).`);
    }

    setIsSaving(false);
  }

  async function handleAssignTeacher(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTeacherId || !selectedAssignmentClassSubjectId) {
      setMessage("Selecione um professor e uma turma/disciplina.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("teacher_assignments")
      .insert({
        teacher_id: selectedTeacherId,
        class_subject_id: selectedAssignmentClassSubjectId
      })
      .select(
        "id, teacher_id, class_subject_id, profiles(full_name), class_subjects(classes(name, school_year), subjects(name))"
      )
      .single();

    if (error) {
      setMessage("Nao foi possivel vincular. Talvez esse professor ja tenha esse vinculo.");
    } else if (data) {
      setTeacherAssignments((current) => [
        ...current,
        ...normalizeTeacherAssignments([data])
      ]);
      setSelectedAssignmentClassSubjectId("");
      setMessage("Professor vinculado.");
    }

    setIsSaving(false);
  }

  async function handleDeleteTeacherAssignment(assignmentId: string) {
    setIsSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("teacher_assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) {
      setMessage("Nao foi possivel remover o vinculo do professor.");
    } else {
      setTeacherAssignments((current) =>
        current.filter((assignment) => assignment.id !== assignmentId)
      );
      setMessage("Vinculo do professor removido.");
    }

    setIsSaving(false);
  }

  async function handleReviewAssignmentRequest(
    request: AssignmentRequest,
    status: "approved" | "rejected"
  ) {
    setIsSaving(true);
    setMessage("");

    if (status === "approved") {
      const { data: assignment, error: assignmentError } = await supabase
        .from("teacher_assignments")
        .insert({
          teacher_id: request.teacher_id,
          class_subject_id: request.class_subject_id
        })
        .select(
          "id, teacher_id, class_subject_id, profiles(full_name), class_subjects(classes(name, school_year), subjects(name))"
        )
        .single();

      if (assignmentError && assignmentError.code !== "23505") {
        setMessage("Nao foi possivel criar o vinculo do professor.");
        setIsSaving(false);
        return;
      }

      if (assignment) {
        setTeacherAssignments((current) => [
          ...current,
          ...normalizeTeacherAssignments([assignment])
        ]);
      }
    }

    const { data, error } = await supabase
      .from("teacher_assignment_requests")
      .update({
        status,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", request.id)
      .select(
        "id, teacher_id, class_subject_id, status, profiles(full_name), class_subjects(classes(name, school_year), subjects(name))"
      )
      .single();

    if (error || !data) {
      setMessage("Nao foi possivel atualizar a solicitacao.");
    } else {
      const [updatedRequest] = normalizeAssignmentRequests([data]);
      setAssignmentRequests((current) =>
        current.map((currentRequest) =>
          currentRequest.id === request.id ? updatedRequest : currentRequest
        )
      );
      setMessage(status === "approved" ? "Solicitacao aprovada." : "Solicitacao recusada.");
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
  const selectedClass = classes.find((schoolClass) => schoolClass.id === selectedClassId);
  const selectedClassSubjects = sortedClassSubjects.filter(
    (classSubject) => classSubject.class_id === selectedClassId
  );
  const linkedSubjectIds = new Set(
    selectedClassSubjects.map((classSubject) => classSubject.subject_id)
  );
  const sortedTeacherAssignments = [...teacherAssignments].sort((left, right) => {
    const leftTeacher = left.profiles?.full_name ?? "";
    const rightTeacher = right.profiles?.full_name ?? "";

    if (leftTeacher !== rightTeacher) {
      return leftTeacher.localeCompare(rightTeacher);
    }

    return formatClassSubject(left.class_subjects).localeCompare(
      formatClassSubject(right.class_subjects)
    );
  });
  const teacherAssignmentIds = new Set(
    teacherAssignments.map(
      (assignment) => `${assignment.teacher_id}:${assignment.class_subject_id}`
    )
  );
  const sortedAssignmentRequests = [...assignmentRequests].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "pending" ? -1 : 1;
    }

    return (left.profiles?.full_name ?? "").localeCompare(right.profiles?.full_name ?? "");
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
        <p className="helper-text">
          Selecione uma turma para ver quais disciplinas estao vinculadas atualmente.
        </p>
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
                <option
                  disabled={linkedSubjectIds.has(subject.id)}
                  key={subject.id}
                  value={subject.id}
                >
                  {subject.name}
                  {linkedSubjectIds.has(subject.id) ? " - ja vinculada" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button className="primary-button" disabled={isSaving} type="submit">
          Vincular disciplina
        </button>

        <RecordList
          emptyText={
            isLoading
              ? "Carregando..."
              : selectedClassId
                ? "Nenhuma disciplina vinculada a turma selecionada."
                : "Selecione uma turma para ver as disciplinas."
          }
          heading={
            selectedClass
              ? `${selectedClass.name} - ${selectedClass.school_year}: ${selectedClassSubjects.length} disciplina(s)`
              : undefined
          }
          items={selectedClassSubjects.map((classSubject) => ({
            id: classSubject.id,
            title: classSubject.subjects?.name ?? "Disciplina",
            detail: "Vinculada a turma",
            onDelete: () => handleDeleteClassSubject(classSubject.id)
          }))}
        />
      </form>

      <form className="management-card wide-card" onSubmit={handleDuplicateClass}>
        <h3>Duplicar turma</h3>
        <div className="inline-form-grid three-columns">
          <label>
            Turma origem
            <select
              onChange={(event) => setSourceClassId(event.target.value)}
              value={sourceClassId}
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
            Nova turma
            <input
              onChange={(event) => setDuplicateClassName(event.target.value)}
              placeholder="6o Ano B"
              value={duplicateClassName}
            />
          </label>

          <label>
            Ano letivo
            <input
              inputMode="numeric"
              max="2100"
              min="2000"
              onChange={(event) => setDuplicateSchoolYear(event.target.value)}
              type="number"
              value={duplicateSchoolYear}
            />
          </label>
        </div>

        <button className="primary-button" disabled={isSaving} type="submit">
          Duplicar com disciplinas
        </button>
      </form>

      <form className="management-card wide-card" onSubmit={handleAssignTeacher}>
        <h3>Professores por turma/disciplina</h3>
        <p className="helper-text">
          O professor passa a acessar os alunos e lancamentos das turmas vinculadas aqui.
        </p>

        <div className="inline-form-grid">
          <label>
            Professor
            <select
              onChange={(event) => setSelectedTeacherId(event.target.value)}
              value={selectedTeacherId}
            >
              <option value="">Selecione</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.full_name ?? teacher.id}
                </option>
              ))}
            </select>
          </label>

          <label>
            Turma e disciplina
            <select
              onChange={(event) => setSelectedAssignmentClassSubjectId(event.target.value)}
              value={selectedAssignmentClassSubjectId}
            >
              <option value="">Selecione</option>
              {sortedClassSubjects.map((classSubject) => {
                const isLinked = teacherAssignmentIds.has(
                  `${selectedTeacherId}:${classSubject.id}`
                );

                return (
                  <option disabled={isLinked} key={classSubject.id} value={classSubject.id}>
                    {classSubject.classes?.name ?? "Turma"} -{" "}
                    {classSubject.subjects?.name ?? "Disciplina"}
                    {classSubject.classes?.school_year
                      ? ` (${classSubject.classes.school_year})`
                      : ""}
                    {isLinked ? " - ja vinculado" : ""}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        <button className="primary-button" disabled={isSaving} type="submit">
          Vincular professor
        </button>

        <RecordList
          emptyText={
            isLoading
              ? "Carregando..."
              : teachers.length === 0
                ? "Nenhum professor cadastrado ainda."
                : "Nenhum vinculo de professor cadastrado."
          }
          items={sortedTeacherAssignments.map((assignment) => ({
            id: assignment.id,
            title: assignment.profiles?.full_name ?? "Professor",
            detail: formatClassSubject(assignment.class_subjects),
            onDelete: () => handleDeleteTeacherAssignment(assignment.id)
          }))}
        />
      </form>

      <div className="management-card wide-card">
        <h3>Solicitacoes de professores</h3>
        {sortedAssignmentRequests.length === 0 ? (
          <p className="empty-state">
            {isLoading ? "Carregando..." : "Nenhuma solicitacao recebida."}
          </p>
        ) : (
          <ul className="record-list">
            {sortedAssignmentRequests.map((request) => (
              <li key={request.id}>
                <span>
                  <strong>{request.profiles?.full_name ?? "Professor"}</strong>
                  <small>
                    {formatClassSubject(request.class_subjects)} - {formatRequestStatus(request.status)}
                  </small>
                </span>
                {request.status === "pending" ? (
                  <span className="status-controls">
                    <button
                      className="small-action-button"
                      disabled={isSaving}
                      type="button"
                      onClick={() => handleReviewAssignmentRequest(request, "approved")}
                    >
                      Aprovar
                    </button>
                    <button
                      className="text-button"
                      disabled={isSaving}
                      type="button"
                      onClick={() => handleReviewAssignmentRequest(request, "rejected")}
                    >
                      Recusar
                    </button>
                  </span>
                ) : null}
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
    ...row,
    classes: Array.isArray(row.classes) ? (row.classes[0] ?? null) : row.classes,
    subjects: Array.isArray(row.subjects) ? (row.subjects[0] ?? null) : row.subjects
  }));
}

function normalizeTeacherAssignments(rows: TeacherAssignmentRow[]): TeacherAssignment[] {
  return rows.map((row) => {
    const classSubject = Array.isArray(row.class_subjects)
      ? (row.class_subjects[0] ?? null)
      : row.class_subjects;

    return {
      ...row,
      profiles: Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles,
      class_subjects: classSubject
        ? {
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

function normalizeAssignmentRequests(rows: AssignmentRequestRow[]): AssignmentRequest[] {
  return rows.map((row) => {
    const normalized = normalizeTeacherAssignments([
      {
        id: row.id,
        teacher_id: row.teacher_id,
        class_subject_id: row.class_subject_id,
        profiles: row.profiles,
        class_subjects: row.class_subjects
      }
    ])[0];

    return {
      id: row.id,
      teacher_id: row.teacher_id,
      class_subject_id: row.class_subject_id,
      status: row.status,
      profiles: normalized.profiles,
      class_subjects: normalized.class_subjects
    };
  });
}

function formatClassSubject(classSubject: TeacherAssignment["class_subjects"]) {
  const className = classSubject?.classes?.name ?? "Turma";
  const subjectName = classSubject?.subjects?.name ?? "Disciplina";
  const schoolYear = classSubject?.classes?.school_year;

  return `${className} - ${subjectName}${schoolYear ? ` (${schoolYear})` : ""}`;
}

function formatRequestStatus(status: AssignmentRequest["status"]) {
  if (status === "approved") {
    return "aprovada";
  }

  if (status === "rejected") {
    return "recusada";
  }

  return "pendente";
}

function RecordList({
  emptyText,
  heading,
  items
}: {
  emptyText: string;
  heading?: string;
  items: Array<{
    id: string;
    title: string;
    detail: string;
    onDelete: () => void;
  }>;
}) {
  if (items.length === 0) {
    return (
      <div className="record-list-block">
        {heading ? <p className="list-heading">{heading}</p> : null}
        <p className="empty-state">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="record-list-block">
      {heading ? <p className="list-heading">{heading}</p> : null}
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
    </div>
  );
}
