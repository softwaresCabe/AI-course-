import type { FuturePath } from './types';

// "Paths to improve the future of AI" — concrete ways to contribute after the course.
export const futurePaths: FuturePath[] = [
  {
    title: 'Reliable & verifiable agents',
    why: 'Agents fail through compounding errors and inconsistent behavior across runs. Making them dependable is what unlocks AI in critical systems like POS, logistics and healthcare.',
    problems: ['Measuring and raising pass^k (consistency), not just pass@1', 'Verification steps and self-checking that actually catch errors', 'Safe action spaces, approvals and rollback for real-world side effects', 'Long-horizon memory and recovery after failures'],
    firstSteps: ['Open-source a domain benchmark (e.g. warehouse exceptions) with verifiable end states', 'Contribute tools or evals to the MCP ecosystem', 'Publish trajectory analyses comparing agent designs per dollar'],
    resources: [
      { title: 'τ-bench', author: 'Yao et al.', url: 'https://arxiv.org/abs/2406.12045', kind: 'paper' },
      { title: 'Model Context Protocol', author: 'MCP project', url: 'https://modelcontextprotocol.io/', kind: 'docs' },
    ],
  },
  {
    title: 'Evaluation science',
    why: 'You cannot improve what you cannot measure. Benchmarks saturate and leak; the field needs better ways to measure real-world capability and risk.',
    problems: ['Contamination-resistant and dynamic benchmarks', 'Validated LLM-as-judge methods and their statistics', 'Evals for open-ended, agentic and long-horizon tasks', 'Measuring dangerous capabilities responsibly'],
    firstSteps: ['Contribute tasks to open eval frameworks (e.g. Inspect, lm-evaluation-harness)', 'Write up judge-calibration results for a real domain', 'Build a public leaderboard for a niche but economically important task'],
    resources: [
      { title: 'Inspect (UK AI Security Institute eval framework)', author: 'UK AISI', url: 'https://inspect.aisi.org.uk/', kind: 'docs' },
      { title: 'lm-evaluation-harness', author: 'EleutherAI', url: 'https://github.com/EleutherAI/lm-evaluation-harness', kind: 'docs' },
    ],
  },
  {
    title: 'Mechanistic interpretability',
    why: 'Understanding what models compute internally lets us audit them for hidden goals, debug failures and build justified trust as systems become more capable.',
    problems: ['Scaling feature discovery (SAEs, transcoders) to frontier models', 'Tracing circuits behind reasoning and refusals', 'Detecting deception or misaligned goals from internals', 'Turning interpretability into practical debugging tools'],
    firstSteps: ['Work through ARENA’s interpretability curriculum', 'Use TransformerLens / open SAE libraries on small open models', 'Replicate a published result and post it (e.g. on LessWrong / Alignment Forum)'],
    resources: [
      { title: 'Transformer Circuits Thread', author: 'Anthropic', url: 'https://transformer-circuits.pub/', kind: 'paper' },
      { title: 'ARENA curriculum', author: 'ARENA', url: 'https://www.arena.education/', kind: 'course' },
      { title: 'TransformerLens', author: 'TransformerLens contributors', url: 'https://github.com/TransformerLensOrg/TransformerLens', kind: 'docs' },
    ],
  },
  {
    title: 'Alignment & scalable oversight',
    why: 'As models approach and exceed human ability in domains, we need ways to specify goals and supervise behavior that keep working.',
    problems: ['Reward hacking and specification gaming in RL-trained models', 'Sycophancy and honesty', 'Faithful, monitorable chain-of-thought', 'Oversight via debate, AI-assisted review and decomposition'],
    firstSteps: ['Take BlueDot Impact’s Technical AI Safety course', 'Reproduce a small reward-hacking or sycophancy experiment with your Lab 7 setup', 'Apply to fellowships (e.g. MATS, Anthropic Fellows-style programs)'],
    resources: [
      { title: 'BlueDot Impact courses (Technical AI Safety, AGI Strategy, Frontier AI Governance)', author: 'BlueDot Impact', url: 'https://bluedot.org/', kind: 'course' },
      { title: 'Concrete Problems in AI Safety', author: 'Amodei et al.', url: 'https://arxiv.org/abs/1606.06565', kind: 'paper' },
    ],
  },
  {
    title: 'AI security',
    why: 'Prompt injection, data exfiltration and supply-chain attacks are unsolved and rising as agents gain access to email, code and money.',
    problems: ['Architectures that separate untrusted data from privileged actions', 'Injection detection and robust agent design', 'Secure tool permissions and identity for agents', 'Model and dataset supply-chain integrity'],
    firstSteps: ['Red-team your own capstone and publish the findings', 'Contribute to the OWASP GenAI Security Project', 'Build an injection test suite for MCP servers'],
    resources: [
      { title: 'OWASP Top 10 for LLM Applications', author: 'OWASP', url: 'https://genai.owasp.org/llm-top-10/', kind: 'docs' },
      { title: 'Indirect Prompt Injection', author: 'Greshake et al.', url: 'https://arxiv.org/abs/2302.12173', kind: 'paper' },
    ],
  },
  {
    title: 'Efficient & local AI',
    why: 'Cheaper, faster, smaller models put AI on devices and in offline or low-margin settings — small restaurants, rural warehouses, festivals with no connectivity.',
    problems: ['Quantization and distillation without capability loss', 'Fast inference kernels and serving systems', 'Offline-first hybrid local/cloud architectures', 'Energy efficiency of training and inference'],
    firstSteps: ['Contribute to llama.cpp, vLLM or SGLang (docs, benchmarks, small fixes)', 'Publish an offline-first AI POS reference architecture', 'Distill a task-specific small model and open-source it with evals'],
    resources: [
      { title: 'vLLM', author: 'vLLM project', url: 'https://github.com/vllm-project/vllm', kind: 'docs' },
      { title: 'llama.cpp', author: 'ggml-org', url: 'https://github.com/ggml-org/llama.cpp', kind: 'docs' },
    ],
  },
  {
    title: 'AI for underserved industries',
    why: 'Most value from AI will come from applying it well in real businesses. Small operators (independent restaurants, regional logistics) are underserved by today’s tools.',
    problems: ['Reliable voice and text ordering for small businesses', 'Exception handling and forecasting in logistics', 'Trustworthy automation with humans in the loop', 'Affordable, privacy-preserving deployments'],
    firstSteps: ['Ship your capstone to real users and measure outcomes', 'Write case studies with real numbers', 'Open-source reusable industry components (MCP servers, eval sets)'],
    resources: [
      { title: 'AI Engineering (book)', author: 'Chip Huyen', kind: 'book' },
      { title: 'Building effective agents', author: 'Anthropic', url: 'https://www.anthropic.com/research/building-effective-agents', kind: 'blog' },
    ],
  },
  {
    title: 'AI governance & policy',
    why: 'Technical people who understand both systems and policy are scarce. Standards, audits and regulation need engineers who know what is actually possible.',
    problems: ['Practical compliance for the EU AI Act and similar laws', 'Third-party audits and model documentation standards', 'Compute governance and incident reporting', 'Measuring societal and economic impacts'],
    firstSteps: ['Write model/system cards for your projects', 'Follow and comment on NIST AI RMF and standards work', 'Read reports from national AI safety/security institutes'],
    resources: [
      { title: 'NIST AI Risk Management Framework', author: 'NIST', url: 'https://www.nist.gov/itl/ai-risk-management-framework', kind: 'docs' },
      { title: 'EU AI Act Explorer', author: 'Future of Life Institute', url: 'https://artificialintelligenceact.eu/', kind: 'docs' },
    ],
  },
];
