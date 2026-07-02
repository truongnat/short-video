import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

// All LLM provider key/model fields that can be stored and synced to config.toml
const LLM_FIELDS: Array<{ apiKeyField: string; modelField: string; tomlModelKey: string }> = [
  { apiKeyField: 'gemini_api_key',      modelField: 'gemini_model_name',      tomlModelKey: 'gemini_model_name' },
  { apiKeyField: 'groq_api_key',        modelField: 'groq_model_name',        tomlModelKey: 'groq_model_name' },
  { apiKeyField: 'openai_api_key',      modelField: 'openai_model_name',      tomlModelKey: 'openai_model_name' },
  { apiKeyField: 'deepseek_api_key',    modelField: 'deepseek_model_name',    tomlModelKey: 'deepseek_model_name' },
  { apiKeyField: 'moonshot_api_key',    modelField: 'moonshot_model_name',    tomlModelKey: 'moonshot_model_name' },
  { apiKeyField: 'qwen_api_key',        modelField: 'qwen_model_name',        tomlModelKey: 'qwen_model_name' },
  { apiKeyField: 'azure_api_key',       modelField: 'azure_model_name',       tomlModelKey: 'azure_model_name' },
  { apiKeyField: 'grok_api_key',        modelField: 'grok_model_name',        tomlModelKey: 'grok_model_name' },
  { apiKeyField: 'volcengine_api_key',  modelField: 'volcengine_model_name',  tomlModelKey: 'volcengine_model_name' },
];

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private prisma: PrismaService) {}

  async getSettings() {
    const list = await this.prisma.systemSetting.findMany();
    const result: Record<string, string> = {};
    for (const item of list) {
      result[item.key] = item.value;
    }

    // Defaults
    const defaults: Record<string, string> = {
      llm_provider: 'groq',
      default_voice: 'vi-VN-HoaiMyNeural',
      default_aspect_ratio: '9:16',
      default_video_source: 'pexels',
    };

    // Default empty strings for all provider fields
    for (const f of LLM_FIELDS) {
      defaults[f.apiKeyField] = '';
      defaults[f.modelField] = '';
    }

    return { ...defaults, ...result };
  }

  async updateSettings(settings: Record<string, string>) {
    for (const [key, value] of Object.entries(settings)) {
      const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      await this.prisma.systemSetting.upsert({
        where: { key },
        update: { value: valStr },
        create: { key, value: valStr },
      });
    }

    // Synchronize to engine/config.toml
    this.syncToConfigToml(settings);

    return this.getSettings();
  }

  private syncToConfigToml(settings: Record<string, string>) {
    try {
      const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
      const configPath = path.join(projectRoot, 'engine', 'config.toml');
      if (!fs.existsSync(configPath)) {
        this.logger.warn(`engine/config.toml not found at: ${configPath}`);
        return;
      }

      let content = fs.readFileSync(configPath, 'utf8');

      // Sync active provider
      if (settings.llm_provider) {
        content = this.replaceTomlValue(content, 'llm_provider', settings.llm_provider);
      }

      // Sync all provider API keys and model names
      for (const f of LLM_FIELDS) {
        if (settings[f.apiKeyField] !== undefined) {
          content = this.replaceTomlValue(content, f.apiKeyField, settings[f.apiKeyField]);
        }
        if (settings[f.modelField] !== undefined && settings[f.modelField] !== '') {
          content = this.replaceTomlValue(content, f.tomlModelKey, settings[f.modelField]);
        }
      }

      fs.writeFileSync(configPath, content, 'utf8');
      this.logger.log('Successfully synchronized system settings to engine/config.toml');
    } catch (error: any) {
      this.logger.error('Failed to sync settings to engine/config.toml:', error);
    }
  }

  private replaceTomlValue(content: string, key: string, value: string): string {
    const regex = new RegExp(`^(\\s*${key}\\s*=\\s*).*$`, 'm');
    if (regex.test(content)) {
      return content.replace(regex, `$1"${value}"`);
    } else {
      // Append under [app] section if key doesn't exist
      return content.replace(/\[app\]/, `[app]\n${key} = "${value}"`);
    }
  }
}
