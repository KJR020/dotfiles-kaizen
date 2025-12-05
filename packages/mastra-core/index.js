import { ZodError } from 'zod';

class FlowError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'FlowError';
    this.cause = cause;
  }
}

export class Flow {
  constructor(options) {
    this.id = options.id;
    this.inputSchema = options.inputSchema;
    this.outputSchema = options.outputSchema;
    this.steps = options.steps;
    this.buildOutput = options.buildOutput;
  }

  async run(input, context) {
    const validatedInput = this.inputSchema ? this._parseWithSchema(this.inputSchema, input, 'input') : input;
    const results = {};
    const executed = new Set();
    const stepNames = Object.keys(this.steps);
    let guard = 0;

    while (executed.size < stepNames.length) {
      if (guard > stepNames.length * 2) {
        throw new FlowError('Circular dependency detected in flow steps');
      }

      for (const name of stepNames) {
        if (executed.has(name)) continue;
        const step = this.steps[name];
        const deps = step.dependsOn || [];
        const ready = deps.every((dep) => executed.has(dep));
        if (!ready) continue;

        try {
          const result = await step.run({ input: validatedInput, context, stepResults: results });
          results[name] = result;
          executed.add(name);
        } catch (error) {
          throw new FlowError(`Step '${name}' failed`, error);
        }
      }
      guard += 1;
    }

    const outputCandidate = this.buildOutput ? this.buildOutput(results) : results[stepNames[stepNames.length - 1]];
    const output = this.outputSchema
      ? this._parseWithSchema(this.outputSchema, outputCandidate, 'output')
      : outputCandidate;

    return { output, stepResults: results };
  }

  _parseWithSchema(schema, value, label) {
    try {
      return schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new FlowError(`Invalid ${label}: ${error.message}`, error);
      }
      throw new FlowError(`Failed to parse ${label}`, error);
    }
  }
}

export class Step {
  constructor(config) {
    this.run = config.run;
    this.dependsOn = config.dependsOn;
  }
}

export class AgentTool {
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.execute = config.execute;
  }
}

export function tool(config) {
  return new AgentTool(config);
}

export class Agent {
  constructor(options) {
    this.name = options.name;
    this.tools = options.tools || [];
  }

  async run(input) {
    if (typeof input === 'string') {
      if (!this.tools[0]) throw new FlowError('No tool configured for agent');
      return this.tools[0].execute(input);
    }
    if (!this.tools[0]) throw new FlowError('No tool configured for agent');
    return this.tools[0].execute(input);
  }
}

export class Mastra {
  constructor(config) {
    this.agents = config.agents || {};
    this.flows = config.flows || {};
  }
}

export class Memory {
  constructor() {
    this.values = new Map();
  }
  set(key, value) {
    this.values.set(key, value);
  }
  get(key) {
    return this.values.get(key);
  }
}
