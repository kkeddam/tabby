import { Terminal } from '@xterm/xterm'
import { PlatformService } from 'tabby-core'

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
     * Handle a selection event with optional prevention
     */
    handleSelection (preventEvent: boolean): void {
        if (preventEvent) {
            this.skipNextSelectionEvent = true
        }

        const selection = this.terminal.getSelection()
        if (selection && this.copyOnSelect && !preventEvent) {
            if (this.onSelection) {
                this.onSelection(selection)
            }
        }
    }

    /**
     * Copy the selection to clipboard
     *
     * @param text The text to copy
     * @param platformService Platform service for clipboard operations
     * @param copyAsHTML Whether to include HTML formatting
     * @param getHTMLFn Function to get HTML representation of selection
     */
    copySelectionToClipboard (
        text: string,
        platformService: PlatformService,
        copyAsHTML: boolean,
        getHTMLFn: () => string,
    ): void {
        if (!text.trim().length) {
            return
        }

        // Use copyAsHTML and getHTMLFn to resolve the linting issue
        if (copyAsHTML) {
            platformService.setClipboard({
                text: text,
                html: getHTMLFn(),
            })
        } else {
            platformService.setClipboard({
                text: text,
            })
        }

        if (this.onSelection) {
            this.onSelection(text)
        }
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
