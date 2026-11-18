import { course } from '../content/meta';
import { catalog } from '../content/catalog';
import { go } from '../router';

export function Syllabus() {
  const { weeks, exams } = catalog();
  const totalHours = weeks.reduce((s, w) => s + w.hours, 0);
  const totalQ = weeks.reduce((s, w) => s + w.quiz.count, 0) + exams.midterm.questionCount + exams.final.questionCount;
  return (
    <div className="space-y-8">
      <header>
        <div className="kicker">{course.code} · Syllabus</div>
        <h1 className="mt-1 font-serif text-3xl font-bold sm:text-4xl">{course.title}</h1>
        <p className="mt-2 text-ink-soft">{course.subtitle}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-4">
        {[
          ['13', 'weeks'],
          [`~${totalHours}`, 'study hours'],
          ['12 + 1', 'labs + capstone'],
          [String(totalQ), 'graded questions'],
        ].map(([v, l]) => (
          <div key={l} className="card p-4">
            <div className="font-serif text-3xl font-bold">{v}</div>
            <div className="text-xs text-ink-mute">{l}</div>
          </div>
        ))}
      </section>

      <section className="card p-5">
        <h2 className="mb-2 font-serif text-xl font-semibold">Course description</h2>
        <p className="font-serif leading-relaxed">
          This course takes a working software engineer from the mathematical foundations of machine learning to designing, evaluating and operating production AI systems. The first half builds a deep, first-principles understanding of how modern AI works — gradients and backpropagation, tokenization and embeddings, attention and the transformer, pretraining and scaling laws, post-training (SFT, RLHF, DPO, reasoning RL) and inference systems. The second half is AI engineering practice: prompting and tool use, retrieval-augmented generation on Postgres, agents and the Model Context Protocol, evaluation science, security, alignment and LLMOps. Each week pairs lecture notes and primary-source readings with a hands-on lab in Python or TypeScript; labs build toward a capstone deployed in a real product.
        </p>
        <p className="mt-3 text-sm text-ink-mute">
          <span className="font-medium text-ink">Prerequisites: </span>
          {course.prerequisites}
        </p>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-serif text-xl font-semibold">Learning outcomes</h2>
        <p className="mb-2 text-sm text-ink-mute">On completion you will be able to:</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>Derive and implement the core mathematics of neural network training (gradients, backpropagation, cross-entropy, optimizers).</li>
          <li>Implement a GPT-style transformer from scratch and explain every component and its cost.</li>
          <li>Estimate training and inference compute, memory and cost, and reason with scaling laws.</li>
          <li>Explain and apply post-training methods (SFT, RLHF, DPO, RL with verifiable rewards) and parameter-efficient fine-tuning.</li>
          <li>Serve and optimize models: KV cache, batching, quantization, speculative decoding.</li>
          <li>Build reliable LLM features with structured outputs, tools, RAG and agents, including MCP servers.</li>
          <li>Design statistically sound evaluations and defend systems against prompt injection and other risks.</li>
          <li>Explain the central open problems in alignment, interpretability and AI governance, and identify a path to contribute.</li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl font-semibold">Schedule</h2>
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-mute">
              <tr>
                <th className="px-4 py-3">Wk</th>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Lab</th>
                <th className="px-4 py-3">Assessment</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.n} className="cursor-pointer border-t border-paper-line align-top hover:bg-paper" onClick={() => go(`week-${w.n}`)}>
                  <td className="px-4 py-2.5 font-mono">{w.n}</td>
                  <td className="px-4 py-2.5 font-medium">{w.title}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{w.lab.title.replace(/^(Lab \d+|Capstone) — /, '')}</td>
                  <td className="px-4 py-2.5 text-ink-soft">
                    Quiz {w.n}
                    {w.n === 6 ? ' · Midterm' : ''}
                    {w.n === 13 ? ' · Final · Capstone' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-serif text-xl font-semibold">Grading</h2>
          <ul className="space-y-2 text-sm">
            {course.grading.map((g) => (
              <li key={g.key} className="flex justify-between gap-3 border-b border-paper-line pb-2 last:border-0">
                <div>
                  <div className="font-medium">{g.label}</div>
                  <div className="text-xs text-ink-mute">{g.note}</div>
                </div>
                <span className="font-mono">{g.weight}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 font-serif text-xl font-semibold">Letter grades</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {course.letterScale.map((s) => (
              <div key={s.letter} className="flex justify-between border-b border-paper-line py-1">
                <span className="font-medium">{s.letter}</span>
                <span className="font-mono text-ink-mute">≥ {s.min}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-serif text-xl font-semibold">Policies</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          {course.policies.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-serif text-xl font-semibold">Core texts</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm">
          <li>Goodfellow, Bengio & Courville — <em>Deep Learning</em> (free online)</li>
          <li>Deisenroth, Faisal & Ong — <em>Mathematics for Machine Learning</em> (free online)</li>
          <li>Zhang, Lipton, Li & Smola — <em>Dive into Deep Learning</em> (free online)</li>
          <li>Chip Huyen — <em>AI Engineering: Building Applications with Foundation Models</em> (O’Reilly)</li>
          <li>Andrej Karpathy — <em>Neural Networks: Zero to Hero</em> (video lectures)</li>
          <li>Primary-source papers listed each week</li>
        </ul>
      </section>
    </div>
  );
}
