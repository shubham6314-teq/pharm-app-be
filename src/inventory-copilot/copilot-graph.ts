import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
  SystemMessage,
} from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  COPILOT_SYSTEM_PROMPT,
  DEFAULT_COPILOT_MODEL_TIMEOUT_MS,
  MAX_COPILOT_STEPS,
} from './inventory-copilot.constants.js';
import { iterateWithIdleTimeout, withTimeout } from './copilot-timeout.js';

export type CopilotBoundModel = {
  invoke: (messages: BaseMessage[]) => Promise<AIMessage>;
  stream?: (
    messages: BaseMessage[],
  ) => AsyncIterable<AIMessage | AIMessageChunk>;
};

export type CopilotModel = {
  bindTools: (tools: StructuredToolInterface[]) => CopilotBoundModel;
};

export type CopilotGraphHooks = {
  onToken?: (text: string) => void;
  onStatus?: (text: string) => void;
  modelTimeoutMs?: number;
};

const CopilotState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  steps: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
});

type CopilotSnapshot = typeof CopilotState.State;

function messageText(message: AIMessage | AIMessageChunk): string {
  return typeof message.content === 'string' ? message.content : '';
}

function withSystem(messages: BaseMessage[]): BaseMessage[] {
  return [new SystemMessage(COPILOT_SYSTEM_PROMPT), ...messages];
}

function toChunk(message: AIMessage | AIMessageChunk): AIMessageChunk {
  return AIMessageChunk.isInstance(message)
    ? message
    : new AIMessageChunk({
        content: message.content,
        tool_calls: message.tool_calls,
      });
}

function toolNames(message: AIMessage): string {
  return (message.tool_calls ?? []).map((call) => call.name).join(', ');
}

async function runModel(
  bound: CopilotBoundModel,
  messages: BaseMessage[],
  hooks: CopilotGraphHooks,
): Promise<AIMessage> {
  const prompted = withSystem(messages);
  const timeoutMs = hooks.modelTimeoutMs ?? DEFAULT_COPILOT_MODEL_TIMEOUT_MS;

  if (!bound.stream) {
    return withTimeout(bound.invoke(prompted), timeoutMs);
  }

  let assembled: AIMessageChunk | undefined;
  let sawTools = false;
  const chunks = iterateWithIdleTimeout(bound.stream(prompted), timeoutMs);

  for await (const chunk of chunks) {
    const next = toChunk(chunk);
    assembled = assembled ? assembled.concat(next) : next;
    if ((chunk.tool_calls?.length ?? 0) > 0) {
      sawTools = true;
    }
    const text = messageText(chunk);
    if (text && !sawTools && hooks.onToken) {
      hooks.onToken(text);
    }
  }

  if (!assembled) {
    return new AIMessage('');
  }

  return new AIMessage({
    content: assembled.content,
    tool_calls: assembled.tool_calls,
  });
}

export function createCopilotGraph(
  model: CopilotModel,
  tools: StructuredToolInterface[],
  hooks: CopilotGraphHooks = {},
) {
  const bound = model.bindTools(tools);

  const graph = new StateGraph(CopilotState)
    .addNode('investigate', async (state: CopilotSnapshot) => {
      const step = state.steps + 1;
      hooks.onStatus?.(`Calling Gemini (step ${step})`);
      const response = await runModel(bound, state.messages, hooks);
      const names = toolNames(response);
      if (names) {
        hooks.onStatus?.(`Using ${names}`);
      }
      return {
        messages: [response],
        steps: step,
      };
    })
    .addNode('tools', new ToolNode(tools))
    .addEdge(START, 'investigate')
    .addConditionalEdges('investigate', (state: CopilotSnapshot) => {
      const last = state.messages.at(-1);
      const hasToolCalls =
        AIMessage.isInstance(last) && (last.tool_calls?.length ?? 0) > 0;
      if (hasToolCalls && state.steps < MAX_COPILOT_STEPS) {
        return 'tools';
      }

      return END;
    })
    .addEdge('tools', 'investigate');

  return graph.compile();
}
