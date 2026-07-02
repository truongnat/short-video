import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

type IdeaGenerationOptions = {
  existingTitles?: string[];
  anchorTitle?: string;
  anchorDescription?: string;
};

export type ActiveLlmProviderConfig = {
  provider: string;
  apiKey: string;
  model: string;
};

export type GeneratedIdea = {
  title: string;
  description: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

type OpenAICompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function isGeneratedIdea(value: unknown): value is GeneratedIdea {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as GeneratedIdea).title === 'string' &&
    typeof (value as GeneratedIdea).description === 'string'
  );
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private prisma: PrismaService) {}

  private async getSetting(key: string, defaultValue = ''): Promise<string> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting ? setting.value : defaultValue;
  }

  async getActiveProviderConfig(): Promise<ActiveLlmProviderConfig> {
    const provider = await this.getSetting('llm_provider', 'groq');
    const apiKeyMap: Record<string, string> = {
      gemini:
        (await this.getSetting('gemini_api_key', '')) ||
        process.env.GEMINI_API_KEY ||
        '',
      groq: await this.getSetting('groq_api_key', ''),
      openai: await this.getSetting('openai_api_key', ''),
      deepseek: await this.getSetting('deepseek_api_key', ''),
      moonshot: await this.getSetting('moonshot_api_key', ''),
      qwen: await this.getSetting('qwen_api_key', ''),
      azure: await this.getSetting('azure_api_key', ''),
      grok: await this.getSetting('grok_api_key', ''),
      volcengine: await this.getSetting('volcengine_api_key', ''),
    };
    const apiKey =
      apiKeyMap[provider] || (await this.getSetting('llm_api_key', ''));

    const modelKey =
      provider === 'gemini'
        ? 'gemini_model_name'
        : provider === 'groq'
          ? 'groq_model_name'
          : provider === 'openai'
            ? 'openai_model_name'
            : provider === 'deepseek'
              ? 'deepseek_model_name'
              : provider === 'moonshot'
                ? 'moonshot_model_name'
                : provider === 'qwen'
                  ? 'qwen_model_name'
                  : provider === 'azure'
                    ? 'azure_model_name'
                    : provider === 'grok'
                      ? 'grok_model_name'
                      : provider === 'volcengine'
                        ? 'volcengine_model_name'
                        : null;

    return {
      provider,
      apiKey,
      model: modelKey
        ? await this.getSetting(modelKey, '')
        : await this.getSetting('llm_model', 'gemini-2.5-flash'),
    };
  }

  async generateIdeas(
    topic: string,
    language = 'vi',
    options: IdeaGenerationOptions = {},
  ): Promise<GeneratedIdea[]> {
    const { provider, apiKey, model } = await this.getActiveProviderConfig();

    if (!apiKey) {
      this.logger.warn(
        `LLM API key is missing for provider "${provider}". Rejecting idea generation request.`,
      );
      throw new BadRequestException(
        'Chưa cấu hình API key cho AI provider hiện tại. Vào Cài đặt để bật tính năng gợi ý ý tưởng.',
      );
    }

    const existingTitles = options.existingTitles
      ?.map((title) => title.trim())
      .filter(Boolean);
    const duplicateGuard =
      existingTitles && existingTitles.length > 0
        ? `Không được trùng hoặc gần trùng với các tiêu đề đã có sau đây: ${existingTitles
            .map((title) => `"${title}"`)
            .join(', ')}.`
        : '';
    const relatedContext = options.anchorTitle
      ? `Ngữ cảnh hiện tại: người dùng đang xem ý tưởng "${options.anchorTitle}"${
          options.anchorDescription
            ? ` với ghi chú "${options.anchorDescription}".`
            : '.'
        } Hãy đề xuất những góc khai thác mới cùng chủ đề, đủ khác biệt để người dùng có thể chọn tiếp, không viết lại cùng một ý tưởng bằng từ ngữ khác.`
      : '';

    const prompt = `Bạn là chuyên gia sáng tạo nội dung video ngắn (TikTok, Reels, Shorts).
Dựa vào chủ đề: "${topic}", hãy gợi ý 5 ý tưởng video ngắn thu hút người xem.
${relatedContext}
${duplicateGuard}
Yêu cầu trả về kết quả dưới dạng JSON Array thuần túy, KHÔNG có markdown, KHÔNG có thẻ \`\`\`json. Mỗi phần tử có cấu trúc:
{
  "title": "Tiêu đề video ngắn gọn, tò mò",
  "description": "Mô tả ngắn gọn nội dung và kịch bản hình ảnh"
}
Ngôn ngữ trả về: ${language === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh'}.
Tiêu đề phải cụ thể, dễ hiểu, không dùng placeholder, không đánh số thứ tự, không lặp lại cấu trúc câu y hệt nhau.`;

    try {
      let resultText = '';

      const openAIBaseUrl = (): string => {
        const urls: Record<string, string> = {
          groq: 'https://api.groq.com/openai/v1/chat/completions',
          openai: 'https://api.openai.com/v1/chat/completions',
          deepseek: 'https://api.deepseek.com/v1/chat/completions',
          moonshot: 'https://api.moonshot.cn/v1/chat/completions',
          qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
          grok: 'https://api.x.ai/v1/chat/completions',
          volcengine:
            'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        };
        return urls[provider] || '';
      };

      const defaultModel = (): string => {
        const models: Record<string, string> = {
          groq: 'llama-3.3-70b-versatile',
          openai: 'gpt-4o-mini',
          deepseek: 'deepseek-chat',
          moonshot: 'moonshot-v1-8k',
          qwen: 'qwen-max',
          azure: 'gpt-35-turbo',
          grok: 'grok-4.3',
          volcengine: 'doubao-seed-2-1-turbo-260628',
        };
        return models[provider] || '';
      };

      if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });
        if (!response.ok) {
          throw new Error(
            `Gemini API returned ${response.status}: ${await response.text()}`,
          );
        }
        const data = (await response.json()) as GeminiResponse;
        resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (provider === 'azure') {
        const baseUrl = await this.getSetting('azure_base_url', '');
        const url = `${baseUrl}/openai/deployments/${model}/chat/completions?api-version=2024-08-01-preview`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
          }),
        });
        if (!response.ok) {
          throw new Error(
            `Azure OpenAI API returned ${response.status}: ${await response.text()}`,
          );
        }
        const data = (await response.json()) as OpenAICompatibleResponse;
        resultText = data.choices?.[0]?.message?.content || '';
      } else {
        const url = openAIBaseUrl();
        if (!url) {
          throw new Error(`Unsupported LLM provider: ${provider}`);
        }
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model || defaultModel(),
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
          }),
        });
        if (!response.ok) {
          throw new Error(
            `${provider} API returned ${response.status}: ${await response.text()}`,
          );
        }
        const data = (await response.json()) as OpenAICompatibleResponse;
        resultText = data.choices?.[0]?.message?.content || '';
      }

      if (!resultText) {
        throw new Error('LLM returned empty response');
      }

      // Cleanup response text in case LLM wrapped it in markdown code blocks
      resultText = resultText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      const parsed: unknown = JSON.parse(resultText);
      if (!Array.isArray(parsed)) {
        throw new Error('LLM response is not a valid array');
      }
      for (const item of parsed) {
        if (!isGeneratedIdea(item)) {
          throw new Error('LLM response items missing title or description');
        }
      }
      return parsed as GeneratedIdea[];
    } catch (error: unknown) {
      this.logger.error(
        `Failed to generate ideas using LLM: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new Error(
        'Không thể tạo ý tưởng bằng AI. Vui lòng kiểm tra lại API Key và cấu hình LLM.',
      );
    }
  }
}
