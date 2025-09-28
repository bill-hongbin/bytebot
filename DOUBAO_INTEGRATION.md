# Doubao Model Integration

This document describes the integration of ByteDance's Doubao models into the Bytebot project.

## Models Supported

The following Doubao models have been added:

1. **doubao-seed-1-6-250615** - Main Doubao Seed 1.6 model (default)
2. **doubao-seed-1.6-thinking** - Enhanced thinking capabilities
3. **doubao-seed-1.6-flash** - High-speed variant

All models support:
- 256K context window
- Multi-modal input (text and images)
- Function calling via OpenAI-compatible API
- Context7 MCP integration

## Implementation Details

### New Files Created

- `/packages/bytebot-agent/src/doubao/doubao.constants.ts` - Model definitions and constants
- `/packages/bytebot-agent/src/doubao/doubao.service.ts` - Main service implementation
- `/packages/bytebot-agent/src/doubao/doubao.tools.ts` - Tool definitions for function calling
- `/packages/bytebot-agent/src/doubao/doubao.module.ts` - NestJS module configuration

### Files Modified

1. **Agent Types**: Added 'doubao' to valid providers
   - `/packages/bytebot-agent/src/agent/agent.types.ts`
   - `/packages/bytebot-agent-cc/src/agent/agent.types.ts`

2. **Module Integration**: Added Doubao service to dependency injection
   - `/packages/bytebot-agent/src/app.module.ts`
   - `/packages/bytebot-agent/src/agent/agent.module.ts`
   - `/packages/bytebot-agent/src/agent/agent.processor.ts`

3. **LiteLLM Configuration**: Added Doubao models to proxy
   - `/packages/bytebot-llm-proxy/litellm-config.yaml`

4. **Environment Configuration**: Added DOUBAO_API_KEY support
   - `/docker/docker-compose.yml`
   - `/helm/values.yaml`
   - `/helm/charts/bytebot-agent/templates/secret.yaml`
   - `/helm/charts/bytebot-agent/templates/deployment.yaml`

## Configuration

### Environment Variables

Add the following environment variable to your deployment:

```bash
DOUBAO_API_KEY="your-doubao-api-key-here"
```

### Docker Compose

The `docker-compose.yml` file has been updated to include the `DOUBAO_API_KEY` environment variable.

### Helm Configuration

Two configuration methods are available:

1. **Legacy method** (for backward compatibility):
   ```yaml
   bytebot-agent:
     env:
       DOUBAO_API_KEY: "your-key-here"
   ```

2. **New secret management** (recommended):
   ```yaml
   bytebot-agent:
     apiKeys:
       doubao:
         useExisting: false
         secretName: ""
         secretKey: "doubao-api-key"
         value: "your-key-here"
   ```

### LiteLLM Proxy

The Doubao models are configured to use the Volcengine API endpoint:

```yaml
- model_name: doubao-seed-1-6-250615
  litellm_params:
    model: openai/doubao-seed-1-6-250615
    api_base: https://ark.cn-beijing.volces.com/api/v3
    api_key: os.environ/DOUBAO_API_KEY
```

## API Integration

The Doubao service implements the OpenAI-compatible API format, making it easy to integrate with the existing Bytebot architecture. The service:

1. Converts Bytebot message formats to OpenAI-compatible format
2. Handles function calling/tool use
3. Processes multi-modal content (text and images)
4. Manages token usage tracking
5. Provides proper error handling and abort signal support

## Context7 MCP Support

The implementation is fully compatible with Context7 MCP (Model Context Protocol), allowing for advanced context management and multi-turn conversations with the Doubao models.

## Testing

To test the integration:

1. Set the `DOUBAO_API_KEY` environment variable
2. Deploy the updated services
3. Create a task with the Doubao model selected
4. Verify that the model responds correctly to prompts and function calls

## Notes

- The implementation uses Volcengine's API endpoint (ByteDance's cloud platform)
- All models support the same feature set as other providers in the system
- The integration follows the same patterns as existing OpenAI/Google/Anthropic providers
- Function calling uses the OpenAI function format for compatibility