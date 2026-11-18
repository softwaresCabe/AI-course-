import { useState } from 'react';
import { midterm, finalExam } from '../content/course';
import { useStore } from '../lib/store';
import { QuizRunner } from '../components/QuizRunner';
import { examMax } from '../lib/scores';
import { pointsOf } from '../lib/grading';

export function ExamPage({ id }: { id: 'midterm' | 'final' }) {
  const exam = id === 'midterm' ? midterm : finalExam;
  const { p, update } = useStore();
  const done = p.exams[id];
  const started = p.examStarted[id];
  const [confirm, setConfirm] = useState(false);
  const [review, setReview] = useState(false);
  const counts = exam.questions.reduce<Record<string, number>>((m, q) => ((m[q.type] = (m[q.type] ?? 0) + 1), m), {});

  return (
    <div className="space-y-6">
      <header>
        <div className="kicker">Examination · Weeks {exam.coversWeeks[0]}–{exam.coversWeeks[exam.coversWeeks.length - 1]}</div>
        <h1 className="mt-1 font-serif text-3xl font-bold sm:text-4xl">{exam.title}</h1>
        <p className="mt-2 text-ink-soft">{exam.description}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="chip bg-paper-line">{exam.timeLimitMin} minutes</span>
          <span className="chip bg-paper-line">{exam.questions.length} questions · {examMax(id)} points</span>
          <span className="chip bg-paper-line">
            {counts.mcq ?? 0} MC · {counts.multi ?? 0} select-all · {counts.numeric ?? 0} numeric · {counts.short ?? 0} written
          </span>
          <span className="chip bg-brand-soft text-brand-deep">{id === 'midterm' ? '15%' : '20%'} of course grade · one attempt</span>
        </div>
      </header>

      {done && !review && (
        <div className="card p-5">
          <div className="kicker">Recorded score</div>
          <div className="mt-1 font-serif text-4xl font-bold">{Math.round((100 * done.earned) / done.max)}%</div>
          <div className="text-sm text-ink-mute">
            {done.earned}/{done.max} points · {new Date(done.date).toLocaleString()}
          </div>
          <div className="mt-4 flex gap-3">
            <button className="btn-ghost" onClick={() => setReview(true)}>
              Review graded exam
            </button>
          </div>
        </div>
      )}

      {done && review && <QuizRunner title={exam.title} questions={exam.questions} existing={done} onComplete={() => {}} />}

      {!done && !started && (
        <div className="card p-5">
          <div className="kicker mb-2">Before you begin</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            <li>The timer starts when you press Begin and keeps running if you leave the page. When it reaches zero, the exam auto-submits.</li>
            <li>Closed-book: no notes, AI assistants or internet. A calculator is allowed.</li>
            <li>Numeric answers accept ± tolerance; give the units the question asks for.</li>
            <li>Written answers are graded against a rubric ({exam.questions.filter((q) => q.type === 'short').reduce((s, q) => s + pointsOf(q), 0)} points total).</li>
            <li>One attempt. Your score is recorded in the gradebook.</li>
          </ul>
          {!confirm ? (
            <button className="btn-primary mt-4" onClick={() => setConfirm(true)}>
              Begin exam
            </button>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">Start the {exam.timeLimitMin}-minute timer now?</span>
              <button className="btn-primary" onClick={() => update((d) => void (d.examStarted[id] = new Date().toISOString()))}>
                Yes, start
              </button>
              <button className="btn-ghost" onClick={() => setConfirm(false)}>
                Not yet
              </button>
            </div>
          )}
        </div>
      )}

      {!done && started && (
        <QuizRunner
          title={exam.title}
          questions={exam.questions}
          timeLimitMin={exam.timeLimitMin}
          startedAt={started}
          onComplete={(a) => update((d) => void (d.exams[id] = a))}
        />
      )}
    </div>
  );
}
