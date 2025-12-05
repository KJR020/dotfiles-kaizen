import type { ZodSchema } from 'zod';

declare type StepRunner<I, C, O> = (params: {
  input: I;
  context: C;
  stepResults: Record<string, unknown>;
}) => Promise<O> | O;

declare interface StepConfig<I, C, O> {
  run: StepRunner<I, C, O>;
  dependsOn?: string[];
}

declare interface FlowOptions<I, C, O> {
  id: string;
  inputSchema?: ZodSchema<I>;
  outputSchema?: ZodSchema<O>;
  steps: Record<string, StepConfig<I, C, any>>;
  buildOutput?: (results: Record<string, unknown>) => O;
}

export declare class Flow<I = any, C = any, O = any> {
  constructor(options: FlowOptions<I, C, O>);
  run(input: I, context: C): Promise<{ output: O; stepResults: Record<string, unknown> }>;
}

export declare class Step<I = any, C = any, O = any> {
  run: StepRunner<I, C, O>;
  dependsOn?: string[];
  constructor(config: StepConfig<I, C, O>);
}

export declare class AgentTool<I = any, O = any> {
  name: string;
  description: string;
  execute: (input: I) => Promise<O> | O;
  constructor(config: { name: string; description: string; execute: (input: I) => Promise<O> | O });
}

export declare function tool<I = any, O = any>(config: {
  name: string;
  description: string;
  execute: (input: I) => Promise<O> | O;
}): AgentTool<I, O>;

export declare class Agent<I = any, O = any> {
  name: string;
  tools: AgentTool<I, O>[];
  constructor(options: { name: string; tools?: AgentTool<I, O>[] });
  run(input: I): Promise<O>;
}

export declare class Mastra {
  agents: Record<string, Agent>;
  flows: Record<string, Flow>;
  constructor(config: { agents?: Record<string, Agent>; flows?: Record<string, Flow> });
}

export declare class Memory {
  private values;
  constructor();
  set(key: string, value: unknown): void;
  get<T = unknown>(key: string): T | undefined;
}
