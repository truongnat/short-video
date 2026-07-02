import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

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

const MEDIA_SOURCE_KEYS = [
  'pexels_api_keys',
  'pixabay_api_keys',
  'coverr_api_keys',
  'twelvelabs_api_keys',
];

const TOML_ARRAY_FIELDS = new Set(MEDIA_SOURCE_KEYS);

const TOML_BOOL_FIELDS = new Set([
  'twelvelabs_rerank_terms',
  'tls_verify',
  'enable_redis',
  'upload_post_enabled',
  'upload_post_auto_upload',
  'enable_g4f',
  'hide_log',
  'hide_config',
]);

const SECTION_MAP: Record<string, string> = {
  speech_key: 'azure',
  speech_region: 'azure',
  elevenlabs_api_key: 'elevenlabs',
  elevenlabs_model_id: 'elevenlabs',
  siliconflow_api_key: 'siliconflow',
  chatterbox_base_url: 'chatterbox',
  chatterbox_api_key: 'chatterbox',
  chatterbox_model_id: 'chatterbox',
  whisper_model_size: 'whisper',
  whisper_device: 'whisper',
  whisper_compute_type: 'whisper',
  proxy_http: 'proxy',
  proxy_https: 'proxy',
  subtitle_font_name: 'ui',
};

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

    const defaults: Record<string, string> = {
      llm_provider: 'groq',
      default_voice: 'vi-VN-HoaiMyNeural',
      default_aspect_ratio: '9:16',
      default_video_source: 'pexels',
      subtitle_provider: 'edge',
      tls_verify: 'true',
      edge_tts_timeout: '30',
      enable_redis: 'false',
      twelvelabs_rerank_terms: 'false',
    };

    for (const f of LLM_FIELDS) {
      defaults[f.apiKeyField] = '';
      defaults[f.modelField] = '';
    }

    for (const key of MEDIA_SOURCE_KEYS) {
      defaults[key] = '';
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

      if (settings.llm_provider) {
        content = this.replaceInSection(content, 'app', 'llm_provider', settings.llm_provider, false, false);
      }

      for (const f of LLM_FIELDS) {
        if (settings[f.apiKeyField] !== undefined) {
          content = this.replaceInSection(content, 'app', f.apiKeyField, settings[f.apiKeyField], false, false);
        }
        if (settings[f.modelField] !== undefined && settings[f.modelField] !== '') {
          content = this.replaceInSection(content, 'app', f.tomlModelKey, settings[f.modelField], false, false);
        }
      }

      const mediaKeys = ['pexels_api_keys', 'pixabay_api_keys', 'coverr_api_keys', 'twelvelabs_api_keys'];
      for (const key of mediaKeys) {
        if (settings[key] !== undefined) {
          content = this.replaceInSection(content, 'app', key, settings[key], true, false);
        }
      }

      if (settings.twelvelabs_rerank_terms !== undefined) {
        content = this.replaceInSection(content, 'app', 'twelvelabs_rerank_terms', settings.twelvelabs_rerank_terms, false, true);
      }

      if (settings.subtitle_provider !== undefined) {
        content = this.replaceInSection(content, 'app', 'subtitle_provider', settings.subtitle_provider, false, false);
      }
      if (settings.edge_tts_timeout !== undefined) {
        content = this.replaceInSection(content, 'app', 'edge_tts_timeout', settings.edge_tts_timeout, false, false);
      }
      if (settings.tls_verify !== undefined) {
        content = this.replaceInSection(content, 'app', 'tls_verify', settings.tls_verify, false, true);
      }
      if (settings.enable_redis !== undefined) {
        content = this.replaceInSection(content, 'app', 'enable_redis', settings.enable_redis, false, true);
      }

      const sectionKeys: Record<string, Array<{ key: string; isArray: boolean; isBool: boolean }>> = {
        azure: [
          { key: 'speech_key', isArray: false, isBool: false },
          { key: 'speech_region', isArray: false, isBool: false },
        ],
        elevenlabs: [
          { key: 'elevenlabs_api_key', isArray: false, isBool: false },
          { key: 'elevenlabs_model_id', isArray: false, isBool: false },
        ],
        siliconflow: [
          { key: 'siliconflow_api_key', isArray: false, isBool: false },
        ],
        chatterbox: [
          { key: 'chatterbox_base_url', isArray: false, isBool: false },
          { key: 'chatterbox_api_key', isArray: false, isBool: false },
          { key: 'chatterbox_model_id', isArray: false, isBool: false },
        ],
        whisper: [
          { key: 'whisper_model_size', isArray: false, isBool: false },
          { key: 'whisper_device', isArray: false, isBool: false },
          { key: 'whisper_compute_type', isArray: false, isBool: false },
        ],
        ui: [
          { key: 'subtitle_font_name', isArray: false, isBool: false },
        ],
        proxy: [
          { key: 'proxy_http', isArray: false, isBool: false },
          { key: 'proxy_https', isArray: false, isBool: false },
        ],
      };

      for (const [section, fields] of Object.entries(sectionKeys)) {
        for (const f of fields) {
          if (settings[f.key] !== undefined) {
            const tomlKey = f.key.replace(/^[a-z]+_/, '');
            content = this.replaceInSection(content, section, tomlKey, settings[f.key], f.isArray, f.isBool);
          }
        }
      }

      fs.writeFileSync(configPath, content, 'utf8');
      this.logger.log('Successfully synchronized system settings to engine/config.toml');
    } catch (error: any) {
      this.logger.error('Failed to sync settings to engine/config.toml:', error);
    }
  }

  private formatTomlValue(value: string, isArray: boolean, isBool: boolean): string {
    if (isArray) {
      if (!value || value.trim() === '') return '[]';
      const items = value.split(',').map(s => `"${s.trim()}"`).join(', ');
      return `[${items}]`;
    }
    if (isBool) {
      return value === 'true' ? 'true' : 'false';
    }
    return `"${value}"`;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private replaceInSection(content: string, section: string, key: string, value: string, isArray: boolean, isBool: boolean): string {
    const formatted = this.formatTomlValue(value, isArray, isBool);
    const escapedSection = this.escapeRegex(section);
    const escapedKey = this.escapeRegex(key);
    const sectionRegex = new RegExp(`^\\[${escapedSection}\\]`, 'm');
    const replacement = `${key} = ${formatted}`;

    if (!sectionRegex.test(content)) {
      return content + `\n[${section}]\n${replacement}\n`;
    }

    const lines = content.split('\n');
    const result: string[] = [];
    let currentSection = '';
    let replaced = false;

    for (const line of lines) {
      const secMatch = line.match(/^\[(.+)\]$/);
      if (secMatch) {
        if (currentSection === section && !replaced) {
          result.push(replacement);
          replaced = true;
        }
        currentSection = secMatch[1];
        result.push(line);
        continue;
      }

      if (currentSection === section) {
        const keyMatch = line.match(new RegExp(`^\\s*${escapedKey}\\s*=`));
        if (keyMatch && !replaced) {
          result.push(replacement);
          replaced = true;
          continue;
        }
      }

      result.push(line);
    }

    if (!replaced) {
      const targetSecIndex = result.findLastIndex(
        (l) => l.match(new RegExp(`^\\[${escapedSection}\\]$`))
      );
      if (targetSecIndex >= 0) {
        result.splice(targetSecIndex + 1, 0, replacement);
      } else {
        result.push(replacement);
      }
    }

    return result.join('\n');
  }
}
