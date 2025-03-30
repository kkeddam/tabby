import { Terminal } from '@xterm/xterm'

/**
 * Terminal input data structure
 */
export interface TerminalInput {
    type: 'data' | 'binary';
    data: string;
}

/**
 * Manages input handling for XTerm.js terminal
 */
export class XTermInputManager {
    constructor (
        private terminal: Terminal,
        private sendInput: (input: TerminalInput) => void,
    ) {}

    /**
     * Initialize input event handlers
     */
    initialize (): void {
        this.terminal.onData(data => {
            this.sendInput({ type: 'data', data })
        })

        this.terminal.onBinary(data => {
            this.sendInput({ type: 'binary', data })
        })
    }

    /**
     * Paste text into the terminal
     */
    paste (text: string): void {
        this.terminal.paste(text)
    }
}
