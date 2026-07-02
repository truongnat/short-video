import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

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

  async generateIdeas(topic: string, language = 'vi'): Promise<any[]> {
    const provider = await this.getSetting('llm_provider', 'gemini');
    let apiKey = '';
    if (provider === 'gemini') {
      apiKey = (await this.getSetting('gemini_api_key', '')) || (await this.getSetting('llm_api_key', '')) || process.env.GEMINI_API_KEY || '';
    } else if (provider === 'groq') {
      apiKey = (await this.getSetting('groq_api_key', '')) || (await this.getSetting('llm_api_key', '')) || '';
    } else {
      apiKey = (await this.getSetting('openai_api_key', '')) || (await this.getSetting('llm_api_key', '')) || '';
    }
    const model = await this.getSetting('llm_model', 'gemini-2.5-flash');

    if (!apiKey) {
      this.logger.warn('LLM API Key is missing. Returning sample ideas.');
      return [
        {
          title: `Ý tưởng 1 về ${topic}`,
          description: `Mô tả ý tưởng 1 về chủ đề ${topic}.`,
        },
        {
          title: `Ý tưởng 2 về ${topic}`,
          description: `Mô tả ý tưởng 2 về chủ đề ${topic}.`,
        },
        {
          title: `Ý tưởng 3 về ${topic}`,
          description: `Mô tả ý tưởng 3 về chủ đề ${topic}.`,
        },
      ];
    }

    const prompt = `Bạn là chuyên gia sáng tạo nội dung video ngắn (TikTok, Reels, Shorts).
Dựa vào chủ đề: "${topic}", hãy gợi ý 5 ý tưởng video ngắn thu hút người xem.
Yêu cầu trả về kết quả dưới dạng JSON Array thuần túy, KHÔNG có markdown, KHÔNG có thẻ \`\`\`json. Mỗi phần tử có cấu trúc:
{
  "title": "Tiêu đề video ngắn gọn, tò mò",
  "description": "Mô tả ngắn gọn nội dung và kịch bản hình ảnh"
}
Ngôn ngữ trả về: ${language === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh'}.`;

    try {
      let resultText = '';
      if (provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });
        const data = await response.json();
        resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else if (provider === 'groq') {
        const response = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model || 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
            }),
          },
        );
        const data = await response.json();
        resultText = data.choices?.[0]?.message?.content || '';
      } else {
        // OpenAI default fallback
        const response = await fetch(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model || 'gpt-4o-mini',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
            }),
          },
        );
        const data = await response.json();
        resultText = data.choices?.[0]?.message?.content || '';
      }

      // Cleanup response text in case LLM wrapped it in markdown code blocks
      resultText = resultText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(resultText);
    } catch (error) {
      this.logger.error('Failed to generate ideas using LLM:', error);
      throw new Error(
        'Không thể tạo ý tưởng bằng AI. Vui lòng kiểm tra lại API Key và cấu hình LLM.',
      );
    }
  }
}
