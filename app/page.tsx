"use client";

import { useMemo, useState } from "react";
import questionBank from "./data/question-bank.json";

type Question = (typeof questionBank)[number];
type Mark = "perfect" | "missing" | "wrong";
type Result = { question: Question; mark: Mark };
type Screen = "setup" | "recall" | "summary";
type QuestionCount = 5 | 10 | 20 | "all";

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

function BrandBar({ onHome }: { onHome: () => void }) {
  return (
    <header className="brandbar">
      <button className="brand" type="button" onClick={onHome} aria-label="Exam Recall Trainer home">
        <span className="brand-mark">ER</span>
        <span>Exam Recall Trainer</span>
      </button>
      <span className="course-chip">CIE Chemistry</span>
    </header>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [paper, setPaper] = useState("all");
  const [selectedTopics, setSelectedTopics] = useState<string[]>(() =>
    Array.from(new Set(questionBank.map((item) => item.topic))),
  );
  const [count, setCount] = useState<QuestionCount>(10);
  const [session, setSession] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [isWeakReview, setIsWeakReview] = useState(false);

  const topics = useMemo(
    () => Array.from(new Set(questionBank.filter((item) => paper === "all" || item.paper === paper).map((item) => item.topic))),
    [paper],
  );
  const filteredQuestions = useMemo(
    () => questionBank.filter(
      (item) => (paper === "all" || item.paper === paper) && selectedTopics.includes(item.topic),
    ),
    [paper, selectedTopics],
  );

  const changePaper = (nextPaper: string) => {
    setPaper(nextPaper);
    setSelectedTopics(Array.from(new Set(
      questionBank.filter((item) => nextPaper === "all" || item.paper === nextPaper).map((item) => item.topic),
    )));
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
      <BrandBar onHome={returnHome} />

      {screen === "setup" && (
        <section className="home-grid">
          <div className="intro">
            <p className="eyebrow">Cambridge IGCSE Chemistry</p>
            <h1>Recall the words<br />that earn the marks.</h1>
            <p className="lede">Practise definitions and short-answer questions against the exact marking points.</p>
            <div className="bank-note"><strong>{questionBank.length}</strong> exam questions ready</div>
          </div>

          <div className="setup-card">
            <div className="step-label"><span>01</span> Set up your session</div>
            <label>
              Paper
              <select value={paper} onChange={(event) => changePaper(event.target.value)}>
                <option value="all">All papers</option>
                <option value="4">Paper 4 · Theory</option>
                <option value="6">Paper 6 · Alternative to Practical</option>
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
            <h2>{current.question}</h2>

            {!revealed ? (
              <div className="recall-prompt">
                <p>Say your answer aloud. Focus on the exact words an examiner would credit.</p>
                <button className="reveal-button" type="button" onClick={() => setRevealed(true)}>Reveal answer</button>
              </div>
            ) : (
              <div className="answer-panel">
                <p className="answer-heading">Marking points</p>
                <ol>{current.answers.map((answer, index) => <li key={`${current.id}-${index}`}><span>{answer}</span></li>)}</ol>
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
    </main>
  );
}
