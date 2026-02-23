import { useState } from 'react'
import { Config } from '../types'
import { X, Key, Bot, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

interface SettingsProps {
  config: Config
  onClose: () => void
  onSave: (apiKey: string, model: string, provider: string) => Promise<void>
}

const PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🤖',
    models: [
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fast)' },
      { value: 'claude-opus-4-5', label: 'Claude Opus 4.5 (Powerful)' },
    ],
    keyHint: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '⚡',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    ],
    keyHint: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: '🔀',
    models: [
      { value: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'openai/gpt-4o', label: 'GPT-4o' },
      { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
      { value: 'google/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
    ],
    keyHint: 'sk-or-...',
    docsUrl: 'https://openrouter.ai/keys',
  },
]

export default function Settings({ config, onClose, onSave }: SettingsProps) {
  const [apiKey, setApiKey] = useState('')
  const [provider, setProvider] = useState(config.provider || 'anthropic')
  const [model, setModel] = useState(config.model || 'claude-sonnet-4-6')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  const selectedProvider = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0]

  async function handleSave() {
    if (!apiKey.trim()) {
      setError('API key is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(apiKey.trim(), model, provider)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Agent Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Current status */}
          <div
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              config.configured
                ? 'bg-green-900/20 border-green-700/50 text-green-400'
                : 'bg-yellow-900/20 border-yellow-700/50 text-yellow-400'
            }`}
          >
            {config.configured ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="text-sm">
              {config.configured
                ? `Agents configured (${config.api_key_preview})`
                : 'Not configured — add your API key below'}
            </span>
          </div>

          {/* Provider selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              AI Provider
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setProvider(p.id)
                    setModel(p.models[0].value)
                  }}
                  className={`p-2 rounded-lg border text-sm font-medium transition-all ${
                    provider === p.id
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  <div className="text-lg mb-0.5">{p.icon}</div>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Model selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Model
            </label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {selectedProvider.models.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* API Key input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">
                {selectedProvider.name} API Key
              </label>
              <a
                href={selectedProvider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                Get key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={selectedProvider.keyHint}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 pr-20"
              />
              <button
                type="button"
                onClick={() => setShowKey(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300 px-2 py-1 bg-slate-700 rounded"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Your API key is stored only in memory and not persisted to disk.
            </p>
          </div>

          {/* tinyclaw info */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-medium text-slate-300">About tinyclaw</span>
            </div>
            <p className="text-xs text-slate-500">
              tinyclaw is a multi-agent AI runtime running in Docker. Agents use tinyclaw to
              process your requests — your API key is only used for LLM calls and never
              stored on disk.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg py-2 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white'
            }`}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  )
}
