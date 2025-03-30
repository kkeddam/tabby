import { Terminal, ITheme } from '@xterm/xterm'

/**
 * Manages themes and appearance for XTerm.js terminal
 */
export class XTermThemeManager {
    private currentTheme: ITheme | null = null

    constructor (
        private terminal: Terminal,
    ) {}

    /**
     * Set terminal theme
     */
    setTheme (theme: ITheme): void {
        this.currentTheme = theme
        this.terminal.options.theme = theme
    }

    /**
     * Get current terminal theme
     */
    getTheme (): ITheme | null {
        return this.currentTheme
    }

    /**
     * Set terminal font
     */
    setFont (fontFamily: string, fontSize: number): void {
        this.terminal.options.fontFamily = fontFamily
        this.terminal.options.fontSize = fontSize
    }
}
