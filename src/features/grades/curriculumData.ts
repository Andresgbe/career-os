// Curriculum map ("malla curricular") transcribed from the user's plan de
// estudios image. Subject names, UC values, and semester totals are
// verified against the "N UC -> M UC" header shown in that image (every
// semester sums exactly). The prerequisite/corequisite connections below
// are a best-effort reading of the diagram's arrows and should be checked
// against the source image — this array is the single place to fix them.

export interface CurriculumSubject {
  id: string;
  name: string;
  uc: number;
  semester: number; // 1-8
  minUC?: number; // "UC Requeridas": needs this many accumulated approved UC
}

export type ConnectionType = "prelacion" | "correquisito";

export interface CurriculumConnection {
  from: string;
  to: string;
  type: ConnectionType;
}

export const SEMESTER_LABELS = [
  "Primer",
  "Segundo",
  "Tercer",
  "Cuarto",
  "Quinto",
  "Sexto",
  "Séptimo",
  "Octavo",
];

export const CURRICULUM_SUBJECTS: CurriculumSubject[] = [
  // Semester 1
  { id: "s1-algebra-trig", name: "Álgebra y Trigonometría", uc: 5, semester: 1 },
  { id: "s1-competencia-textual", name: "Competencia Textual en Español", uc: 5, semester: 1 },
  { id: "s1-identidad-i", name: "Identidad Liderazgo y Compromiso I", uc: 3, semester: 1 },
  { id: "s1-ingles", name: "Inglés", uc: 3, semester: 1 },
  { id: "s1-logica", name: "Lógica", uc: 4, semester: 1 },
  { id: "s1-estrategia-proyeccion", name: "Estrategia y Proyección Profesional", uc: 5, semester: 1 },

  // Semester 2
  { id: "s2-algebra-lineal", name: "Álgebra Lineal", uc: 5, semester: 2 },
  { id: "s2-calculo-diferencial", name: "Cálculo Diferencial", uc: 6, semester: 2 },
  { id: "s2-identidad-ii", name: "Identidad Liderazgo y Compromiso II", uc: 3, semester: 2 },
  { id: "s2-ingles-tecnico", name: "Inglés Técnico", uc: 4, semester: 2 },
  { id: "s2-matematicas-discretas", name: "Matemáticas Discretas", uc: 6, semester: 2 },
  { id: "s2-algoritmos-programacion", name: "Algoritmos y Programación", uc: 7, semester: 2 },

  // Semester 3
  { id: "s3-calculo-integral", name: "Cálculo Integral", uc: 5, semester: 3 },
  { id: "s3-mecanica", name: "Mecánica", uc: 6, semester: 3 },
  { id: "s3-contabilidad-financiera", name: "Contabilidad Financiera", uc: 5, semester: 3, minUC: 40 },
  { id: "s3-organizacion-computador", name: "Organización del Computador", uc: 5, semester: 3 },
  { id: "s3-algoritmos-estructuras-datos", name: "Algoritmos y Estructuras de Datos", uc: 7, semester: 3 },
  { id: "s3-sistemas-informacion", name: "Sistemas de Información", uc: 4, semester: 3 },

  // Semester 4
  { id: "s4-calculo-vectorial", name: "Cálculo Vectorial", uc: 6, semester: 4 },
  { id: "s4-probabilidad-estadistica", name: "Probabilidad y Estadística", uc: 5, semester: 4 },
  { id: "s4-ingenieria-economica", name: "Ingeniería Económica", uc: 4, semester: 4 },
  { id: "s4-sistemas-operativos", name: "Sistemas Operativos", uc: 5, semester: 4 },
  { id: "s4-programacion-oo", name: "Programación Orientada a Objetos", uc: 5, semester: 4 },
  { id: "s4-ingenieria-software", name: "Ingeniería de Software", uc: 5, semester: 4 },
  { id: "s4-ecologia-ambiente", name: "Ecología, Ambiente y Sustentabilidad", uc: 3, semester: 4, minUC: 72 },

  // Semester 5
  { id: "s5-ecuaciones-diferenciales", name: "Ecuaciones Diferenciales Ordinarias", uc: 4, semester: 5 },
  { id: "s5-electricidad-magnetismo", name: "Electricidad y Magnetismo", uc: 6, semester: 5 },
  { id: "s5-diseno-experiencia-usuario", name: "Diseño de Experiencia de Usuario", uc: 4, semester: 5 },
  { id: "s5-redes-comunicacion-datos", name: "Redes de Comunicación de Datos", uc: 6, semester: 5 },
  { id: "s5-gestion-proyectos-software", name: "Gestión de Proyectos de Software", uc: 4, semester: 5 },
  { id: "s5-topicos-especiales-programacion", name: "Tópicos Especiales de Programación", uc: 4, semester: 5 },
  { id: "s5-sistemas-bases-datos", name: "Sistemas de Bases de Datos", uc: 5, semester: 5, minUC: 105 },
  { id: "s5-curso-servicio-comunitario", name: "Curso de Servicio Comunitario", uc: 0, semester: 5, minUC: 105 },

  // Semester 6
  { id: "s6-metodos-numericos", name: "Métodos Numéricos", uc: 2, semester: 6 },
  { id: "s6-arquitectura-computador-aplicada", name: "Arquitectura del Computador Aplicada", uc: 5, semester: 6 },
  { id: "s6-innovacion-emprendimiento", name: "Innovación y Emprendimiento", uc: 3, semester: 6, minUC: 138 },
  { id: "s6-ciberseguridad-ofensiva", name: "Ciberseguridad Ofensiva", uc: 5, semester: 6 },
  { id: "s6-aseguramiento-calidad-software", name: "Aseguramiento de la Calidad del Software", uc: 4, semester: 6 },
  { id: "s6-ingenieria-requisitos", name: "Ingeniería de Requisitos", uc: 4, semester: 6 },
  { id: "s6-topicos-especiales-gestion-datos", name: "Tópicos Especiales de Gestión de Datos", uc: 4, semester: 6 },
  { id: "s6-inteligencia-negocios", name: "Inteligencia de Negocios", uc: 3, semester: 6 },
  { id: "s6-servicio-comunitario", name: "Servicio Comunitario", uc: 0, semester: 6 },

  // Semester 7
  { id: "s7-investigacion-operaciones", name: "Investigación de Operaciones", uc: 5, semester: 7 },
  { id: "s7-ia-aprendizaje-automatico", name: "Inteligencia Artificial: Aprendizaje Automático", uc: 4, semester: 7, minUC: 167 },
  { id: "s7-computacion-nube", name: "Computación en la Nube", uc: 5, semester: 7 },
  { id: "s7-ciberseguridad-defensiva", name: "Ciberseguridad Defensiva", uc: 2, semester: 7 },
  { id: "s7-electiva-informatica", name: "Electiva (Informática)", uc: 3, semester: 7, minUC: 172 },
  { id: "s7-desarrollo-software", name: "Desarrollo de Software", uc: 5, semester: 7 },
  { id: "s7-electiva-complementaria", name: "Electiva Complementaria", uc: 3, semester: 7, minUC: 138 },
  { id: "s7-pasantia", name: "Pasantía", uc: 4, semester: 7 },
  { id: "s7-curso-trabajo-grado", name: "Curso de Trabajo de Grado", uc: 3, semester: 7, minUC: 151 },

  // Semester 8
  { id: "s8-evaluacion-sistemas-informaticos", name: "Evaluación de Sistemas Informáticos", uc: 4, semester: 8 },
  { id: "s8-arquitecturas-empresariales", name: "Arquitecturas Empresariales", uc: 4, semester: 8, minUC: 207 },
  { id: "s8-etica-profesional", name: "Ética Profesional", uc: 3, semester: 8, minUC: 207 },
  { id: "s8-trabajo-grado", name: "Trabajo de Grado (TG)", uc: 12, semester: 8 },
];

export const CURRICULUM_CONNECTIONS: CurriculumConnection[] = [
  // Math/calculus track
  { from: "s1-algebra-trig", to: "s2-algebra-lineal", type: "prelacion" },
  { from: "s1-algebra-trig", to: "s2-calculo-diferencial", type: "prelacion" },
  { from: "s2-algebra-lineal", to: "s3-calculo-integral", type: "prelacion" },
  { from: "s2-calculo-diferencial", to: "s3-calculo-integral", type: "prelacion" },
  { from: "s3-calculo-integral", to: "s4-calculo-vectorial", type: "prelacion" },
  { from: "s3-calculo-integral", to: "s5-ecuaciones-diferenciales", type: "prelacion" },
  { from: "s4-probabilidad-estadistica", to: "s5-ecuaciones-diferenciales", type: "prelacion" },
  { from: "s5-ecuaciones-diferenciales", to: "s6-metodos-numericos", type: "prelacion" },
  { from: "s6-metodos-numericos", to: "s7-investigacion-operaciones", type: "prelacion" },
  { from: "s7-investigacion-operaciones", to: "s8-evaluacion-sistemas-informaticos", type: "prelacion" },

  // Physics/stats track
  { from: "s2-calculo-diferencial", to: "s3-mecanica", type: "prelacion" },
  { from: "s3-mecanica", to: "s4-probabilidad-estadistica", type: "prelacion" },
  { from: "s4-probabilidad-estadistica", to: "s5-electricidad-magnetismo", type: "prelacion" },
  { from: "s5-electricidad-magnetismo", to: "s6-arquitectura-computador-aplicada", type: "prelacion" },
  // s7-ia-aprendizaje-automatico and s8-arquitecturas-empresariales are gated
  // only by their minUC requirement (167 / 207) — no direct subject arrow.

  // Business / gen-ed track
  { from: "s1-identidad-i", to: "s2-identidad-ii", type: "prelacion" },
  // s3-contabilidad-financiera is gated only by minUC 40, no subject arrow.
  { from: "s3-contabilidad-financiera", to: "s4-ingenieria-economica", type: "prelacion" },
  { from: "s4-ingenieria-economica", to: "s5-diseno-experiencia-usuario", type: "prelacion" },
  // s6-innovacion-emprendimiento is gated only by minUC 138, no subject arrow.
  { from: "s6-innovacion-emprendimiento", to: "s7-computacion-nube", type: "prelacion" },
  // s8-etica-profesional is gated only by minUC 207, no subject arrow.

  // Systems track
  { from: "s1-ingles", to: "s2-ingles-tecnico", type: "prelacion" },
  { from: "s2-ingles-tecnico", to: "s3-organizacion-computador", type: "prelacion" },
  { from: "s3-organizacion-computador", to: "s4-sistemas-operativos", type: "prelacion" },
  { from: "s4-sistemas-operativos", to: "s5-redes-comunicacion-datos", type: "prelacion" },
  { from: "s5-redes-comunicacion-datos", to: "s6-ciberseguridad-ofensiva", type: "prelacion" },
  { from: "s6-ciberseguridad-ofensiva", to: "s7-ciberseguridad-defensiva", type: "prelacion" },

  // Software engineering track
  { from: "s1-logica", to: "s2-matematicas-discretas", type: "prelacion" },
  { from: "s2-matematicas-discretas", to: "s3-algoritmos-estructuras-datos", type: "prelacion" },
  { from: "s3-algoritmos-estructuras-datos", to: "s4-programacion-oo", type: "prelacion" },
  { from: "s4-programacion-oo", to: "s5-gestion-proyectos-software", type: "prelacion" },
  { from: "s5-gestion-proyectos-software", to: "s6-aseguramiento-calidad-software", type: "prelacion" },
  // s7-electiva-informatica is gated only by minUC 172, no subject arrow.

  // Programming/info track
  { from: "s1-estrategia-proyeccion", to: "s2-algoritmos-programacion", type: "prelacion" },
  { from: "s2-algoritmos-programacion", to: "s3-sistemas-informacion", type: "prelacion" },
  { from: "s3-sistemas-informacion", to: "s4-ingenieria-software", type: "prelacion" },
  { from: "s4-ingenieria-software", to: "s5-topicos-especiales-programacion", type: "prelacion" },
  { from: "s5-topicos-especiales-programacion", to: "s6-ingenieria-requisitos", type: "prelacion" },
  { from: "s6-ingenieria-requisitos", to: "s7-desarrollo-software", type: "prelacion" },
  { from: "s7-desarrollo-software", to: "s8-trabajo-grado", type: "prelacion" },

  // Data track
  // s5-sistemas-bases-datos is gated only by minUC 105, no subject arrow.
  { from: "s5-sistemas-bases-datos", to: "s6-topicos-especiales-gestion-datos", type: "prelacion" },
  // s7-electiva-complementaria is gated only by minUC 138, no subject arrow.

  // Servicio comunitario / pasantía track
  // s5-curso-servicio-comunitario is gated only by minUC 105, no subject arrow.
  { from: "s5-curso-servicio-comunitario", to: "s6-inteligencia-negocios", type: "prelacion" },
  { from: "s5-curso-servicio-comunitario", to: "s6-servicio-comunitario", type: "prelacion" },
  { from: "s6-inteligencia-negocios", to: "s7-pasantia", type: "prelacion" },
  // s7-curso-trabajo-grado also carries a minUC 151 gate, but the long bent
  // line from Servicio Comunitario to it was clearly visible in the source
  // image, so this one is kept — flag if it's wrong.
  { from: "s6-servicio-comunitario", to: "s7-curso-trabajo-grado", type: "prelacion" },

  // Corequisites (green in the source diagram)
  { from: "s4-programacion-oo", to: "s4-ingenieria-software", type: "correquisito" },
  { from: "s6-topicos-especiales-gestion-datos", to: "s6-ciberseguridad-ofensiva", type: "correquisito" },
  { from: "s7-ciberseguridad-defensiva", to: "s7-computacion-nube", type: "correquisito" },
];

export function getSemesterSubjects(semester: number): CurriculumSubject[] {
  return CURRICULUM_SUBJECTS.filter((s) => s.semester === semester);
}

export interface SemesterTotal {
  semester: number;
  uc: number;
  cumulative: number;
}

export function getSemesterTotals(): SemesterTotal[] {
  let cumulative = 0;
  return Array.from({ length: 8 }, (_, i) => {
    const semester = i + 1;
    const uc = getSemesterSubjects(semester).reduce((acc, s) => acc + s.uc, 0);
    cumulative += uc;
    return { semester, uc, cumulative };
  });
}
