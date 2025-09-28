import { agentTools } from '../agent/agent.tools';

/**
 * Converts an agent tool definition to OpenAI function format for Doubao
 * Since Doubao is OpenAI-compatible, we can use the same format
 */
function agentToolToDoubaoTool(agentTool: any) {
  return {
    type: 'function',
    function: {
      name: agentTool.name,
      description: agentTool.description,
      parameters: agentTool.input_schema,
    },
  };
}

// Convert all agent tools to Doubao format
export const doubaoTools = agentTools.map(agentToolToDoubaoTool);