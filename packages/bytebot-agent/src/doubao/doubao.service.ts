import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MessageContentBlock,
  MessageContentType,
  TextContentBlock,
  ToolUseContentBlock,
  isUserActionContentBlock,
  isComputerToolUseContentBlock,
  isImageContentBlock,
} from '@bytebot/shared';
import { DEFAULT_MODEL, DOUBAO_API_BASE_URL } from './doubao.constants';
import { Message, Role } from '@prisma/client';
import { doubaoTools } from './doubao.tools';
import {
  BytebotAgentService,
  BytebotAgentInterrupt,
  BytebotAgentResponse,
} from '../agent/agent.types';
import { v4 as uuid } from 'uuid';

@Injectable()
export class DoubaoService implements BytebotAgentService {
  private readonly logger = new Logger(DoubaoService.name);
  private readonly apiKey: string;
  private readonly baseURL: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('DOUBAO_API_KEY') || '';
    this.baseURL = this.configService.get<string>('DOUBAO_API_BASE_URL') || DOUBAO_API_BASE_URL;

    if (!this.apiKey) {
      this.logger.warn(
        'DOUBAO_API_KEY is not set. DoubaoService will not work properly.',
      );
    }
  }

  async generateMessage(
    systemPrompt: string,
    messages: Message[],
    model: string = DEFAULT_MODEL.name,
    useTools: boolean = true,
    signal?: AbortSignal,
  ): Promise<BytebotAgentResponse> {
    try {
      const doubaoMessages = this.formatMessagesForDoubao(messages, systemPrompt);
      const maxTokens = 4096;

      const requestBody = {
        model,
        messages: doubaoMessages,
        max_tokens: maxTokens,
        temperature: 0.1,
        tools: useTools ? doubaoTools : undefined,
        tool_choice: useTools ? 'auto' : undefined,
      };

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Doubao API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No choices returned from Doubao API');
      }

      const choice = data.choices[0];
      const message = choice.message;

      return {
        contentBlocks: this.formatDoubaoResponse(message),
        tokenUsage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.logger.log('Doubao API call aborted');
        throw new BytebotAgentInterrupt();
      }
      this.logger.error(
        `Error sending message to Doubao: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private formatMessagesForDoubao(messages: Message[], systemPrompt: string): any[] {
    const doubaoMessages: any[] = [];

    // Add system prompt as the first message
    if (systemPrompt) {
      doubaoMessages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    for (const message of messages) {
      const messageContentBlocks = message.content as MessageContentBlock[];

      if (
        messageContentBlocks.every((block) => isUserActionContentBlock(block))
      ) {
        const userActionContentBlocks = messageContentBlocks.flatMap(
          (block) => block.content,
        );
        
        const content: any[] = [];
        
        for (const block of userActionContentBlocks) {
          if (isComputerToolUseContentBlock(block)) {
            content.push({
              type: 'text',
              text: `User performed action: ${block.name}\n${JSON.stringify(block.input, null, 2)}`,
            });
          } else if (isImageContentBlock(block)) {
            content.push({
              type: 'image_url',
              image_url: {
                url: `data:${block.source.media_type};base64,${block.source.data}`,
                detail: 'high',
              },
            });
          }
        }

        if (content.length > 0) {
          doubaoMessages.push({
            role: 'user',
            content,
          });
        }
      } else {
        // Process regular message content blocks
        const content: any[] = [];

        for (const block of messageContentBlocks) {
          switch (block.type) {
            case MessageContentType.Text:
              content.push({
                type: 'text',
                text: block.text,
              });
              break;
            case MessageContentType.Image:
              content.push({
                type: 'image_url',
                image_url: {
                  url: `data:${block.source.media_type};base64,${block.source.data}`,
                  detail: 'high',
                },
              });
              break;
            case MessageContentType.ToolUse:
              // For assistant messages with tool use, this will be handled in the message role
              if (message.role === Role.ASSISTANT) {
                doubaoMessages.push({
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: block.id,
                      type: 'function',
                      function: {
                        name: block.name,
                        arguments: JSON.stringify(block.input),
                      },
                    },
                  ],
                });
                continue;
              }
              break;
            case MessageContentType.ToolResult:
              doubaoMessages.push({
                role: 'tool',
                tool_call_id: block.tool_use_id,
                content: block.content
                  .filter((c) => c.type === MessageContentType.Text)
                  .map((c) => c.text)
                  .join('\n'),
              });
              
              // Handle images in tool results
              for (const toolContent of block.content) {
                if (toolContent.type === MessageContentType.Image) {
                  doubaoMessages.push({
                    role: 'user',
                    content: [
                      {
                        type: 'image_url',
                        image_url: {
                          url: `data:${toolContent.source.media_type};base64,${toolContent.source.data}`,
                          detail: 'high',
                        },
                      },
                    ],
                  });
                }
              }
              continue;
            default:
              content.push({
                type: 'text',
                text: JSON.stringify(block),
              });
              break;
          }
        }

        if (content.length > 0) {
          doubaoMessages.push({
            role: message.role === Role.USER ? 'user' : 'assistant',
            content,
          });
        }
      }
    }

    return doubaoMessages;
  }

  private formatDoubaoResponse(message: any): MessageContentBlock[] {
    const contentBlocks: MessageContentBlock[] = [];

    // Handle text content
    if (message.content) {
      contentBlocks.push({
        type: MessageContentType.Text,
        text: message.content,
      } as TextContentBlock);
    }

    // Handle tool calls
    if (message.tool_calls && Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          contentBlocks.push({
            type: MessageContentType.ToolUse,
            id: toolCall.id || uuid(),
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments || '{}'),
          } as ToolUseContentBlock);
        }
      }
    }

    // If no content blocks, add empty text block
    if (contentBlocks.length === 0) {
      contentBlocks.push({
        type: MessageContentType.Text,
        text: '',
      } as TextContentBlock);
    }

    return contentBlocks;
  }
}