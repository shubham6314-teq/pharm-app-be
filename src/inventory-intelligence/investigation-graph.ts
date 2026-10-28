import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  parseAnalysisDraft,
  validateAnalysisDraft,
  type AnalysisDraft,
  type InvestigationObservations,
} from './analysis-draft.js';
import {
  INVESTIGATION_SYSTEM_PROMPT,
  MAX_INVESTIGATION_STEPS,
} from './inventory-intelligence.constants.js';

export type InvestigationModel = {
  bindTools: (tools: StructuredToolInterface[]) => {
    invoke: (messages: BaseMessage[]) => Promise<AIMessage>;
  };
};

const InvestigationState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  alertId: Annotation<string>,
  productId: Annotation<string>,
  observations: Annotation<InvestigationObservations>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),
  draft: Annotation<AnalysisDraft | null>({
    reducer: (_left, right) => right,
    default: () => null,
  }),
  validationErrors: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  steps: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
});

type InvestigationSnapshot = typeof InvestigationState.State;

function messageText(message: BaseMessage | undefined): string {
  if (!message) {
    return '';
  }

  return typeof message.content === 'string' ? message.content : '';
}

function captureObservations(
  messages: BaseMessage[],
): InvestigationObservations {
  const observations: InvestigationObservations = {};

  for (const message of messages) {
    if (!ToolMessage.isInstance(message) || !message.name) {
      continue;
    }

    try {
      const parsed = JSON.parse(String(message.content)) as
        | InvestigationObservations[keyof InvestigationObservations]
        | undefined;
      if (parsed && typeof parsed === 'object') {
        if (message.name === 'getProduct') {
          observations.getProduct = parsed as InvestigationObservations['getProduct'];
        } else if (message.name === 'getInventory') {
          observations.getInventory =
            parsed as InvestigationObservations['getInventory'];
        } else if (message.name === 'getConsumption') {
          observations.getConsumption =
            parsed as InvestigationObservations['getConsumption'];
        } else if (message.name === 'searchKnowledge') {
          observations.searchKnowledge =
            parsed as InvestigationObservations['searchKnowledge'];
        }
      }
    } catch {
      const failure = { ok: false as const, error: 'Tool output was not JSON.' };
      if (message.name === 'getProduct') {
        observations.getProduct = failure;
      } else if (message.name === 'getInventory') {
        observations.getInventory = failure;
      } else if (message.name === 'getConsumption') {
        observations.getConsumption = failure;
      } else if (message.name === 'searchKnowledge') {
        observations.searchKnowledge = failure;
      }
    }
  }

  return observations;
}

export function createInvestigationGraph(
  model: InvestigationModel,
  tools: StructuredToolInterface[],
) {
  const boundModel = model.bindTools(tools);

  const graph = new StateGraph(InvestigationState)
    .addNode('prepare', (state: InvestigationSnapshot) => ({
      messages: [
        new SystemMessage(INVESTIGATION_SYSTEM_PROMPT),
        new HumanMessage(
          `Investigate low-stock alert ${state.alertId} for product ${state.productId}.`,
        ),
      ],
    }))
    .addNode('investigate', async (state: InvestigationSnapshot) => {
      const response = await boundModel.invoke(state.messages);
      return {
        messages: [response],
        steps: state.steps + 1,
      };
    })
    .addNode('tools', new ToolNode(tools))
    .addNode('capture', (state: InvestigationSnapshot) => ({
      observations: captureObservations(state.messages),
    }))
    .addNode('validate', (state: InvestigationSnapshot) => {
      const parsed = parseAnalysisDraft(
        messageText(state.messages.at(-1)),
      );
      if (!parsed.ok) {
        return {
          draft: null,
          validationErrors: [parsed.error],
          ...(state.steps < MAX_INVESTIGATION_STEPS
            ? {
                messages: [
                  new HumanMessage(
                    `${parsed.error} Call any remaining tools, then reply with JSON only.`,
                  ),
                ],
              }
            : {}),
        };
      }

      const validationErrors = validateAnalysisDraft(
        parsed.draft,
        state.observations,
      );
      return {
        draft: parsed.draft,
        validationErrors,
        ...(validationErrors.length > 0 &&
        state.steps < MAX_INVESTIGATION_STEPS
          ? {
              messages: [
                new HumanMessage(
                  `Fix these issues and reply with JSON only:\n${validationErrors.join('\n')}`,
                ),
              ],
            }
          : {}),
      };
    })
    .addEdge(START, 'prepare')
    .addEdge('prepare', 'investigate')
    .addConditionalEdges('investigate', (state: InvestigationSnapshot) => {
      const last = state.messages.at(-1);
      const hasToolCalls =
        AIMessage.isInstance(last) && (last.tool_calls?.length ?? 0) > 0;
      if (hasToolCalls && state.steps < MAX_INVESTIGATION_STEPS) {
        return 'tools';
      }

      return 'validate';
    })
    .addEdge('tools', 'capture')
    .addEdge('capture', 'investigate')
    .addConditionalEdges('validate', (state: InvestigationSnapshot) => {
      if (state.validationErrors.length === 0 && state.draft) {
        return END;
      }

      if (state.steps >= MAX_INVESTIGATION_STEPS) {
        return END;
      }

      return 'investigate';
    });

  return graph.compile();
}
