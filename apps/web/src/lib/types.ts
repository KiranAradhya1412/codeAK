export type Difficulty = "Easy" | "Medium" | "Hard";
export type Language = "python" | "javascript" | "cpp" | "java";
export type Verdict = "Accepted" | "Executed" | "Wrong Answer" | "Time Limit Exceeded" | "Compilation Error" | "Runtime Error";

export interface Problem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  category: string;
  description: string;
  input_format: string;
  output_format: string;
  examples: { input: string; output: string }[];
  starter_code: Partial<Record<Language, string>>;
  time_limit: number;
  memory_limit: number;
}

export interface SampleResult {
  status: Verdict;
  stdout: string;
  expectedOutput: string;
}

export interface ExecutionResult {
  status: Verdict;
  mode: "sample" | "submit";
  stdout?: string;
  stderr?: string;
  timeMs: number | null;
  memoryBytes: number | null;
  passed?: number;
  total?: number;
  message?: string;
  sampleResults?: SampleResult[];
}
