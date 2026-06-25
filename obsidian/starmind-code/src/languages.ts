import type { LanguageSupport } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { html }       from '@codemirror/lang-html'
import { css }        from '@codemirror/lang-css'
import { python }     from '@codemirror/lang-python'
import { vue }        from '@codemirror/lang-vue'

// Map file extension → language factory.
// To add a language: import it, add the extension entries here.
export const LANGUAGES: Record<string, () => LanguageSupport> = {
	js:   () => javascript(),
	mjs:  () => javascript(),
	cjs:  () => javascript(),
	ts:   () => javascript( { typescript: true } ),
	mts:  () => javascript( { typescript: true } ),
	jsx:  () => javascript( { jsx: true } ),
	tsx:  () => javascript( { jsx: true, typescript: true } ),
	html: () => html(),
	htm:  () => html(),
	css:  () => css(),
	py:   () => python(),
	vue:  () => vue(),
}

export const EXTENSIONS = Object.keys( LANGUAGES )
