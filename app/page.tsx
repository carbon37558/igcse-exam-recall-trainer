"use client";

import { useMemo, useState } from "react";
import questionBank from "./data/question-bank.json";

type Question = (typeof questionBank)[number];
type Mark = "perfect" | "missing" | "wrong";
type Result = { question: Question; mark: Mark };
type Screen = "setup" | "recall" | "summary";
type QuestionCount = 5 | 10 | 20 | "all";
type ScientificValue = string | {
  text: string;
  segments: Array<{ text: string; script?: "sub" | "sup" }>;
};
type CourseConfig = {
  id: string;
  label: string;
  hero: string;
  papers: string[];
  paperLabels: Record<string, string>;
};

const courseConfigs: CourseConfig[] = [
  {
    id: "CIE_IGCSE_CHEM",
    label: "CIE IGCSE CHEM",
    hero: "Cambridge IGCSE Chemistry",
    papers: ["4", "6"],
    paperLabels: { "4": "Paper 4 · Theory", "6": "Paper 6 · Alternative to Practical" },
  },
  {
    id: "IB_CHEM_HL",
    label: "IB CHEM HL",
    hero: "IB Chemistry HL",
    papers: ["1B", "2"],
    paperLabels: { "1B": "Paper 1B", "2": "Paper 2" },
  },
];

const markDetails: Record<Mark, { label: string; hint: string }> = {
  perfect: { label: "Perfect", hint: "All marking points recalled" },
  missing: { label: "Missing keywords", hint: "Right idea, incomplete wording" },
  wrong: { label: "Wrong", hint: "Could not recall the answer" },
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function ScientificText({ value }: { value: ScientificValue }) {
  if (typeof value === "string") return value;
  return value.segments.map((segment, index) => {
    if (segment.script === "sub") return <sub key={index}>{segment.text}</sub>;
    if (segment.script === "sup") return <sup key={index}>{segment.text}</sup>;
    return segment.text;
  });
}

function BrandBar({ courseId, courses, onCourseChange, onHome }: {
  courseId: string;
  courses: CourseConfig[];
  onCourseChange: (courseId: string) => void;
  onHome: () => void;
}) {
  return (
    <header className="brandbar">
      <button className="brand" type="button" onClick={onHome} aria-label="Exam Recall Trainer home">
        <span className="brand-mark">ER</span>
        <span>Exam Recall Trainer</span>
      </button>
      <nav className="course-selector" aria-label="Course">
        {courses.map((course) => (
          <button
            className={`course-chip${course.id === courseId ? " selected" : ""}`}
            type="button"
            aria-pressed={course.id === courseId}
            onClick={() => onCourseChange(course.id)}
            key={course.id}
          >
            {course.label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <p className="footer-copyright">© 2026 Adam SUN</p>
        <div className="footer-product">
          <strong>Exam Recall Trainer</strong>
          <span>Created by Adam SUN</span>
        </div>
        <address className="footer-contact">
          <strong>Contact:</strong>
          <span>WeChat: carbon37558</span>
          <a href="mailto:adam51538@hotmail.com">Email: adam51538@hotmail.com</a>
        </address>
      </div>
    </footer>
  );
}

export default function Home() {
  const courses = useMemo(() => Array.from(new Set(questionBank.map((question) => question.course_id))).map((id) =>
    courseConfigs.find((course) => course.id === id) ?? {
      id,
      label: id.replaceAll("_", " "),
      hero: id.replaceAll("_", " "),
      papers: [],
      paperLabels: {},
    }), []);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const course = courses.find((item) => item.id === courseId) ?? courses[0];
  const courseQuestions = useMemo(
    () => questionBank.filter((item) => item.course_id === courseId),
    [courseId],
  );
  const [screen, setScreen] = useState<Screen>("setup");
  const [paper, setPaper] = useState("all");
  const [selectedTopics, setSelectedTopics] = useState<string[]>(() =>
    Array.from(new Set(questionBank.filter((item) => item.course_id === (courses[0]?.id ?? "")).map((item) => item.topic))),
  );
  const [count, setCount] = useState<QuestionCount>(10);
  const [session, setSession] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [isWeakReview, setIsWeakReview] = useState(false);

  const topics = useMemo(
    () => Array.from(new Set(courseQuestions.filter((item) => paper === "all" || item.paper === paper).map((item) => item.topic))),
    [courseQuestions, paper],
  );
  const filteredQuestions = useMemo(
    () => courseQuestions.filter(
      (item) => (paper === "all" || item.paper === paper) && selectedTopics.includes(item.topic),
    ),
    [courseQuestions, paper, selectedTopics],
  );
  const papers = useMemo(() => {
    const available = Array.from(new Set(courseQuestions.map((item) => item.paper)));
    const configured = (course?.papers ?? []).filter((item) => available.includes(item));
    return [...configured, ...available.filter((item) => !configured.includes(item))];
  }, [course, courseQuestions]);

  const changePaper = (nextPaper: string) => {
    setPaper(nextPaper);
    setSelectedTopics(Array.from(new Set(
      courseQuestions.filter((item) => nextPaper === "all" || item.paper === nextPaper).map((item) => item.topic),
    )));
  };

  const changeCourse = (nextCourseId: string) => {
    const nextQuestions = questionBank.filter((item) => item.course_id === nextCourseId);
    setCourseId(nextCourseId);
    setPaper("all");
    setSelectedTopics(Array.from(new Set(nextQuestions.map((item) => item.topic))));
    setCount(10);
    setSession([]);
    setCurrentIndex(0);
    setRevealed(false);
    setResults([]);
    setIsWeakReview(false);
    setScreen("setup");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((current) => current.includes(topic)
      ? current.filter((item) => item !== topic)
      : [...current, topic]);
  };

  const startSession = (questions: Question[], weakReview = false) => {
    const chosen = weakReview || count === "all"
      ? shuffle(questions)
      : shuffle(questions).slice(0, Math.min(count, questions.length));
    setSession(chosen);
    setCurrentIndex(0);
    setRevealed(false);
    setResults([]);
    setIsWeakReview(weakReview);
    setScreen("recall");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const returnHome = () => {
    setScreen("setup");
    setSession([]);
    setResults([]);
    setRevealed(false);
    setIsWeakReview(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const markAnswer = (mark: Mark) => {
    const nextResults = [...results, { question: session[currentIndex], mark }];
    setResults(nextResults);
    if (currentIndex === session.length - 1) {
      setScreen("summary");
    } else {
      setCurrentIndex((index) => index + 1);
      setRevealed(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const current = session[currentIndex];
  const weakItems = results.filter((result) => result.mark !== "perfect").map((result) => result.question);
  const selectedQuestionCount = count === "all" ? filteredQuestions.length : Math.min(count, filteredQuestions.length);

  return (
    <main className="shell">
      <BrandBar courseId={courseId} courses={courses} onCourseChange={changeCourse} onHome={returnHome} />

      {screen === "setup" && (
        <section className="home-grid">
          <div className="intro">
            <p className="eyebrow">{course?.hero}</p>
            <h1>Recall the words<br />that earn the marks.</h1>
            <p className="lede">Practise definitions and short-answer questions against the exact marking points.</p>
            <div className="bank-note"><strong>{courseQuestions.length}</strong> exam questions ready</div>
          </div>

          <div className="setup-card">
            <div className="step-label"><span>01</span> Set up your session</div>
            <label>
              Paper
              <select value={paper} onChange={(event) => changePaper(event.target.value)}>
                <option value="all">All papers</option>
                {papers.map((item) => <option value={item} key={item}>{course?.paperLabels[item] ?? `Paper ${item}`}</option>)}
              </select>
            </label>
            <fieldset className="topic-selector">
              <div className="topic-heading">
                <legend>Topic</legend>
                <div className="topic-actions">
                  <button type="button" onClick={() => setSelectedTopics(topics)}>Select all</button>
                  <button type="button" onClick={() => setSelectedTopics([])}>Clear all</button>
                </div>
              </div>
              <div className="topic-options">
                {topics.map((item) => (
                  <label className="topic-option" key={item}>
                    <input type="checkbox" checked={selectedTopics.includes(item)} onChange={() => toggleTopic(item)} />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
              {selectedTopics.length === 0 && <p className="topic-warning" role="status">Select at least one topic</p>}
            </fieldset>
            <fieldset>
              <legend>Questions this round</legend>
              <div className="count-options">
                {([5, 10, 20, "all"] as const).map((item) => (
                  <button type="button" className={count === item ? "selected" : ""} onClick={() => setCount(item)} key={item}>
                    {item === "all" ? "ALL" : item}
                  </button>
                ))}
              </div>
            </fieldset>
            <button className="start-button" type="button" onClick={() => startSession(filteredQuestions)} disabled={selectedTopics.length === 0 || filteredQuestions.length === 0}>
              Start recall <span aria-hidden="true">→</span>
            </button>
            <p className="availability">{selectedQuestionCount} questions selected from {filteredQuestions.length} available</p>
          </div>
        </section>
      )}

      {screen === "recall" && current && (
        <section className="practice-shell">
          <div className="practice-topline">
            <div>
              <p className="eyebrow">{isWeakReview ? "Weak-item review" : "Recall session"}</p>
              <p className="progress-copy">Question {currentIndex + 1} / {session.length}</p>
            </div>
            <button className="text-button" type="button" onClick={returnHome}>End session</button>
          </div>
          <div className="progress-track" aria-label={`${currentIndex + 1} of ${session.length} questions`}>
            <span style={{ width: `${((currentIndex + 1) / session.length) * 100}%` }} />
          </div>

          <article className="question-card" aria-live="polite">
            <div className="question-meta"><span>Paper {current.paper}</span><span>{current.topic}</span></div>
            <p className="question-label">Question</p>
            <h2><ScientificText value={current.question as ScientificValue} /></h2>

            {!revealed ? (
              <div className="recall-prompt">
                <p>Say your answer aloud. Focus on the exact words an examiner would credit.</p>
                <button className="reveal-button" type="button" onClick={() => setRevealed(true)}>Reveal answer</button>
              </div>
            ) : (
              <div className="answer-panel">
                <p className="answer-heading">Marking points</p>
                <ol>{current.answers.map((answer, index) => <li key={`${current.id}-${index}`}><span><ScientificText value={answer as ScientificValue} /></span></li>)}</ol>
              </div>
            )}
          </article>

          {revealed && (
            <section className="self-mark" aria-labelledby="self-mark-heading">
              <div><p className="eyebrow">Self-mark</p><h3 id="self-mark-heading">How did you do?</h3></div>
              <div className="mark-buttons">
                {(Object.keys(markDetails) as Mark[]).map((mark) => (
                  <button type="button" className={`mark-${mark}`} onClick={() => markAnswer(mark)} key={mark}>
                    <span>{markDetails[mark].label}</span><small>{markDetails[mark].hint}</small>
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>
      )}

      {screen === "summary" && (
        <section className="summary-shell">
          <p className="eyebrow">Session complete</p>
          <h2>{weakItems.length === 0 ? "Every marking point landed." : "Your recall snapshot"}</h2>
          <p className="summary-lede">{isWeakReview ? "Weak-item review complete." : `You completed ${results.length} questions.`}</p>

          <div className="score-grid">
            {(Object.keys(markDetails) as Mark[]).map((mark) => {
              const total = results.filter((result) => result.mark === mark).length;
              const percentage = results.length ? Math.round((total / results.length) * 100) : 0;
              return (
                <div className={`score-card score-${mark}`} key={mark}>
                  <span>{markDetails[mark].label}</span><strong>{total}</strong><small>{percentage}%</small>
                </div>
              );
            })}
          </div>

          <div className="summary-actions">
            {weakItems.length > 0 && (
              <button className="review-button" type="button" onClick={() => startSession(weakItems, true)}>
                Review weak items <span>{weakItems.length}</span>
              </button>
            )}
            <button className="secondary-button" type="button" onClick={returnHome}>Start a new session</button>
          </div>
        </section>
      )}

      <SiteFooter />
    </main>
  );
}
