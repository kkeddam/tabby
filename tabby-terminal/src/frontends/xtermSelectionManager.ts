import { Terminal } from '@xterm/xterm'

/**
 * Manages selections for XTerm.js terminal
 */
export class XTermSelectionManager {
    private skipNextSelectionEvent = false

    constructor (
        private terminal: Terminal,
        private copyOnSelect = false,
        private onSelection?: (text: string) => void,
    ) {}

    /**
     * Initialize selection event handlers
     */
    initialize (): void {
        this.terminal.onSelectionChange(() => {
            if (this.skipNextSelectionEvent) {
                this.skipNextSelectionEvent = false
                return
            }

            const selection = this.terminal.getSelection()
            if (selection && this.copyOnSelect) {
                if (this.onSelection) {
                    this.onSelection(selection)
                }
            }
        })
    }

    /**
     * Prevent next selection event from triggering handlers
     */
    preventNextSelectionEvent (): void {
        this.skipNextSelectionEvent = true
    }

    /**
     * Set copy on select behavior
     */
    setCopyOnSelect (enabled: boolean): void {
        this.copyOnSelect = enabled
    }

    /**
     * Get copy on select state
     */
    getCopyOnSelect (): boolean {
        return this.copyOnSelect
    }
}
