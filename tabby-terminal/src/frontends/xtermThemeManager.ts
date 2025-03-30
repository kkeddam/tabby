import { Terminal, ITheme } from '@xterm/xterm'
import { ConfigService, ThemesService } from 'tabby-core'
import { TerminalColorScheme } from '../api/interfaces'
import { getTerminalBackgroundColor } from '../helpers'

const COLOR_NAMES = [
    'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
    'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
]

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
     * Generate a terminal theme from a color scheme
     */
    generateTheme (
        scheme: TerminalColorScheme | undefined,
        configService: ConfigService,
        themesService: ThemesService,
    ): ITheme {
        const appColorScheme = themesService._getActiveColorScheme() as TerminalColorScheme
        scheme = scheme ?? appColorScheme

        const theme: ITheme = {
            foreground: scheme.foreground,
            selectionBackground: scheme.selection ?? '#88888888',
            selectionForeground: scheme.selectionForeground ?? undefined,
            background: getTerminalBackgroundColor(configService, themesService, scheme) ?? '#00000000',
            cursor: scheme.cursor,
            cursorAccent: scheme.cursorAccent,
        }

        for (let i = 0; i < COLOR_NAMES.length; i++) {
            theme[COLOR_NAMES[i]] = scheme.colors[i]
        }

        return theme
    }

    /**
     * Set terminal font
     */
    setFont (fontFamily: string, fontSize: number): void {
        this.terminal.options.fontFamily = fontFamily
        this.terminal.options.fontSize = fontSize
    }
}
