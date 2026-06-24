/**
 * Shells — the two shells this plugin can launch, plus their display metadata.
 *
 * One frozen enum-dict keyed UPPER_SNAKE with self-naming string values; SHELL_META carries the
 * tab label and the Lucide ribbon icon for each. Distinct icons so the two ribbon buttons read
 * apart at a glance.
 */

export const SHELL = {
	POWERSHELL: 'powershell',
	BASH: 'bash'
} as const

export type ShellId = typeof SHELL[ keyof typeof SHELL ]

export const SHELL_META: Record<ShellId, { label: string, icon: string }> = {
	powershell: { label: 'PowerShell', icon: 'square-terminal' },
	bash: { label: 'Git Bash', icon: 'terminal' }
}
