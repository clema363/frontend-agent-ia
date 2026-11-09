// Writes the insights catalog's AI system prompt for the backend agent:
//   npm run export:ui-prompt
// Re-run it whenever src/lib/generative-ui/catalog.ts changes.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { insightsCatalog, insightsPromptOptions } from '../src/lib/generative-ui/catalog.ts'

const target = new URL('../docs/generative-ui/insights-system-prompt.md', import.meta.url)
writeFileSync(target, insightsCatalog.prompt(insightsPromptOptions))
console.log(`Prompt written to ${fileURLToPath(target)}`)
