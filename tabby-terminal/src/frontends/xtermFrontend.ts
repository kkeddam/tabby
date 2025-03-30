import deepEqual from 'deep-equal'
import { BehaviorSubject, filter, firstValueFrom, takeUntil } from 'rxjs'
import { Injector } from '@angular/core'
import { ConfigService, getCSSFontFamily, getWindows10Build, HostAppService, HotkeysService, Platform, PlatformService, ThemesService } from 'tabby-core'
import { Frontend, SearchOptions, SearchState } from './frontend'
import { Terminal, ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { LigaturesAddon } from '@xterm/addon-ligatures'
import { ISearchOptions, SearchAddon } from '@xterm/addon-search'
import { WebglAddon } from '@xterm/addon-webgl'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { SerializeAddon } from '@xterm/addon-serialize'
import { ImageAddon } from '@xterm/addon-image'
import { CanvasAddon } from '@xterm/addon-canvas'
import { BaseTerminalProfile, TerminalColorScheme } from '../api/interfaces'
import { getTerminalBackgroundColor } from '../helpers'
import './xterm.css'
import { TerminalCapabilitiesHelper } from './terminalCapabilities.helper'

// Define the TerminalCapabilities interface needed for getCapabilities method
interface TerminalCapabilities {
    // Search capabilities
    findNext: (term: string, searchOptions?: SearchOptions) => SearchState;
    findPrevious: (term: string, searchOptions?: SearchOptions) => SearchState;
    cancelSearch: () => void;

    // Scroll capabilities
    scrollToTop: () => void;
    scrollLines: (amount: number) => void;
    scrollPages: (pages: number) => void;
    scrollToBottom: () => void;

    // Selection capabilities
    getSelection: () => string;
    copySelection: () => void;
    selectAll: () => void;
    clearSelection: () => void;

    // IO capabilities
    write: (data: string) => Promise<void>;
    clear: () => void;
    visualBell: () => void;

    // Configuration capabilities
    configure: (profile: BaseTerminalProfile) => void;
    setZoom: (zoom: number) => void;

    // State capabilities
    saveState: () => any;
    restoreState: (state: string) => void;
    supportsBracketedPaste: () => boolean;
    isAlternateScreenActive: () => boolean;
}

const COLOR_NAMES = [
    'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
    'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
]

class FlowControl {
    private blocked = false
    private blocked$ = new BehaviorSubject<boolean>(false)
    private pendingCallbacks = 0
    private lowWatermark = 5
    private highWatermark = 10
    private bytesWritten = 0
    private bytesThreshold = 1024 * 128

    constructor (private xterm: Terminal) { }

    async write (data: string) {
        if (this.blocked) {
            await firstValueFrom(this.blocked$.pipe(filter(x => !x)))
        }
        this.bytesWritten += data.length
        if (this.bytesWritten > this.bytesThreshold) {
            this.pendingCallbacks++
            this.bytesWritten = 0
            if (!this.blocked && this.pendingCallbacks > this.highWatermark) {
                this.blocked = true
                this.blocked$.next(true)
            }
            this.xterm.write(data, () => {
                this.pendingCallbacks--
                if (this.blocked && this.pendingCallbacks < this.lowWatermark) {
                    this.blocked = false
                    this.blocked$.next(false)
                }
            })
        } else {
            this.xterm.write(data)
        }
    }
}

/** @hidden */
export class XTermFrontend extends Frontend {
    focus (): void {
        throw new Error('Method not implemented.')
    }

    enableResizing = true
    xterm: Terminal
    protected xtermCore: any
    protected enableWebGL = false
    private element?: HTMLElement
    private configuredFontSize = 0
    private configuredLinePadding = 0
    private zoom = 0
    private resizeHandler: () => void
    private configuredTheme: ITheme = {}
    private copyOnSelect = false
    private preventNextOnSelectionChangeEvent = false
    private search = new SearchAddon()
    private searchState: SearchState = { resultCount: 0 }
    private fitAddon = new FitAddon()
    private serializeAddon = new SerializeAddon()
    private ligaturesAddon?: LigaturesAddon
    private webGLAddon?: WebglAddon
    private canvasAddon?: CanvasAddon
    private opened = false
    private resizeObserver?: any
    private flowControl: FlowControl
    private capabilitiesHelper: TerminalCapabilitiesHelper

    private configService: ConfigService
    private hotkeysService: HotkeysService
    private platformService: PlatformService
    private hostApp: HostAppService
    private themes: ThemesService

    constructor (injector: Injector) {
        super(injector)
        this.configService = injector.get(ConfigService)
        this.hotkeysService = injector.get(HotkeysService)
        this.platformService = injector.get(PlatformService)
        this.hostApp = injector.get(HostAppService)
        this.themes = injector.get(ThemesService)

        this.xterm = new Terminal({
            allowTransparency: true,
            allowProposedApi: true,
            overviewRulerWidth: 8,
            windowsPty: process.platform === 'win32' ? {
                backend: this.configService.store.terminal.useConPTY ? 'conpty' : 'winpty',
                buildNumber: getWindows10Build(),
            } : undefined,
        })
        this.flowControl = new FlowControl(this.xterm)
        this.xtermCore = this.xterm['_core']

        this.xterm.onBinary(data => {
            this.input.next(Buffer.from(data, 'binary'))
        })
        this.xterm.onData(data => {
            this.input.next(Buffer.from(data, 'utf-8'))
        })
        this.xterm.onResize(({ cols, rows }) => {
            this.resize.next({ rows, columns: cols })
        })
        this.xterm.onTitleChange(title => {
            this.title.next(title)
        })
        this.xterm.onSelectionChange(() => {
            if (this.getSelection()) {
                if (this.copyOnSelect && !this.preventNextOnSelectionChangeEvent) {
                    this.copySelection()
                }
                this.preventNextOnSelectionChangeEvent = false
            }
        })
        this.xterm.onBell(() => {
            this.bell.next()
        })

        this.xterm.loadAddon(this.fitAddon)
        this.xterm.loadAddon(this.serializeAddon)
        this.xterm.loadAddon(new Unicode11Addon())
        this.xterm.unicode.activeVersion = '11'

        if (this.configService.store.terminal.sixel) {
            this.xterm.loadAddon(new ImageAddon())
        }

        const keyboardEventHandler = (name: string, event: KeyboardEvent) => {
            if (this.isAlternateScreenActive()) {
                let modifiers = 0
                modifiers += event.ctrlKey ? 1 : 0
                modifiers += event.altKey ? 1 : 0
                modifiers += event.shiftKey ? 1 : 0
                modifiers += event.metaKey ? 1 : 0
                if (event.key.startsWith('Arrow') && modifiers === 1) {
                    return true
                }
            }

            // Ctrl-/
            if (event.type === 'keydown' && event.key === '/' && event.ctrlKey) {
                this.input.next(Buffer.from('\u001f', 'binary'))
                return false
            }

            // Ctrl-@
            if (event.type === 'keydown' && event.key === '@' && event.ctrlKey) {
                this.input.next(Buffer.from('\u0000', 'binary'))
                return false
            }

            this.hotkeysService.pushKeyEvent(name, event)

            let ret = true
            if (this.hotkeysService.matchActiveHotkey(true) !== null) {
                event.stopPropagation()
                event.preventDefault()
                ret = false
            }
            return ret
        }

        this.xterm.attachCustomKeyEventHandler((event: KeyboardEvent) => {
            if (this.hostApp.platform !== Platform.Web) {
                if (
                    event.getModifierState('Meta') && event.key.toLowerCase() === 'v' ||
                    event.key === 'Insert' && event.shiftKey
                ) {
                    event.preventDefault()
                    return false
                }
            }
            if (event.getModifierState('Meta') && event.key.startsWith('Arrow')) {
                return false
            }

            return keyboardEventHandler('keydown', event)
        })

        this.xtermCore._scrollToBottom = this.xtermCore.scrollToBottom.bind(this.xtermCore)
        this.xtermCore.scrollToBottom = () => null

        this.resizeHandler = () => {
            try {
                if (this.xterm.element && getComputedStyle(this.xterm.element).getPropertyValue('height') !== 'auto') {
                    this.fitAddon.fit()
                    this.xtermCore.viewport._refresh()
                }
            } catch (e) {
                // tends to throw when element wasn't shown yet
                console.warn('Could not resize xterm', e)
            }
        }

        const oldKeyUp = this.xtermCore._keyUp.bind(this.xtermCore)
        this.xtermCore._keyUp = (e: KeyboardEvent) => {
            this.xtermCore.updateCursorStyle(e)
            if (keyboardEventHandler('keyup', e)) {
                oldKeyUp(e)
            }
        }

        this.xterm.buffer.onBufferChange(() => {
            const altBufferActive = this.xterm.buffer.active.type === 'alternate'
            this.alternateScreenActive.next(altBufferActive)
        })

        // Initialize capabilities helper with implementation methods
        this.capabilitiesHelper = new TerminalCapabilitiesHelper({
            // Search capabilities
            findNext: this.findNextImpl.bind(this),
            findPrevious: this.findPreviousImpl.bind(this),
            cancelSearch: this.cancelSearchImpl.bind(this),

            // Scroll capabilities
            scrollToTop: this.scrollToTopImpl.bind(this),
            scrollLines: this.scrollLinesImpl.bind(this),
            scrollPages: this.scrollPagesImpl.bind(this),
            scrollToBottom: this.scrollToBottomImpl.bind(this),

            // Selection capabilities
            getSelection: this.getSelectionImpl.bind(this),
            copySelection: this.copySelectionImpl.bind(this),
            selectAll: this.selectAllImpl.bind(this),
            clearSelection: this.clearSelectionImpl.bind(this),

            // IO capabilities
            write: this.writeImpl.bind(this),
            clear: this.clearImpl.bind(this),
            visualBell: this.visualBellImpl.bind(this),

            // Configuration capabilities
            configure: this.configureImpl.bind(this),
            setZoom: this.setZoomImpl.bind(this),

            // State capabilities
            saveState: this.saveStateImpl.bind(this),
            restoreState: this.restoreStateImpl.bind(this),
            supportsBracketedPaste: this.supportsBracketedPasteImpl.bind(this),
            isAlternateScreenActive: this.isAlternateScreenActiveImpl.bind(this),
        })

        // Apply the capabilities to this frontend instance
        this.capabilitiesHelper.applyTo(this)
    }

    // Rename original methods to avoid conflicts with interface methods
    private getSelectionImpl (): string {
        return this.xterm.getSelection()
    }

    private copySelectionImpl (): void {
        const text = this.getSelectionImpl()
        if (!text.trim().length) {
            return
        }
        if (text.length < 1024 * 32 && this.configService.store.terminal.copyAsHTML) {
            this.platformService.setClipboard({
                text: this.getSelectionImpl(),
                html: this.getSelectionAsHTML(),
            })
        } else {
            this.platformService.setClipboard({
                text: this.getSelectionImpl(),
            })
        }
    }

    private selectAllImpl (): void {
        this.xterm.selectAll()
    }

    private clearSelectionImpl (): void {
        this.xterm.clearSelection()
    }

    private async writeImpl (data: string): Promise<void> {
        await this.flowControl.write(data)
    }

    private clearImpl (): void {
        this.xterm.clear()
    }

    private visualBellImpl (): void {
        if (this.element) {
            this.element.style.animation = 'none'
            setTimeout(() => {
                this.element!.style.animation = 'terminalShakeFrames 0.3s ease'
            })
        }
    }

    private scrollToTopImpl (): void {
        this.xterm.scrollToTop()
    }

    private scrollPagesImpl (pages: number): void {
        this.xterm.scrollPages(pages)
    }

    private scrollLinesImpl (amount: number): void {
        this.xterm.scrollLines(amount)
    }

    private scrollToBottomImpl (): void {
        this.xtermCore._scrollToBottom()
    }

    private configureImpl (profile: BaseTerminalProfile): void {
        const config = this.configService.store

        setImmediate(() => {
            if (this.xterm.cols && this.xterm.rows && this.xtermCore.charMeasure) {
                if (this.xtermCore.charMeasure) {
                    this.xtermCore.charMeasure.measure(this.xtermCore.options)
                }
                if (this.xtermCore.renderer) {
                    this.xtermCore.renderer._updateDimensions()
                }
                this.resizeHandler()
            }
        })

        this.xtermCore.browser.isWindows = this.hostApp.platform === Platform.Windows
        this.xtermCore.browser.isLinux = this.hostApp.platform === Platform.Linux
        this.xtermCore.browser.isMac = this.hostApp.platform === Platform.macOS

        this.xterm.options.fontFamily = getCSSFontFamily(config)
        this.xterm.options.cursorStyle = {
            beam: 'bar',
        }[config.terminal.cursor] || config.terminal.cursor
        this.xterm.options.cursorBlink = config.terminal.cursorBlink
        this.xterm.options.macOptionIsMeta = config.terminal.altIsMeta
        this.xterm.options.scrollback = config.terminal.scrollbackLines
        this.xterm.options.wordSeparator = config.terminal.wordSeparator
        this.xterm.options.drawBoldTextInBrightColors = config.terminal.drawBoldTextInBrightColors
        this.xterm.options.fontWeight = config.terminal.fontWeight
        this.xterm.options.fontWeightBold = config.terminal.fontWeightBold
        this.xterm.options.minimumContrastRatio = config.terminal.minimumContrastRatio
        this.configuredFontSize = config.terminal.fontSize
        this.configuredLinePadding = config.terminal.linePadding
        this.setFontSize()

        this.copyOnSelect = config.terminal.copyOnSelect

        this.configureColors(profile.terminalColorScheme)

        if (this.opened && config.terminal.ligatures && !this.ligaturesAddon && this.hostApp.platform !== Platform.Web) {
            this.ligaturesAddon = new LigaturesAddon()
            this.xterm.loadAddon(this.ligaturesAddon)
        }
    }

    private setZoomImpl (zoom: number): void {
        this.zoom = zoom
        this.setFontSize()
        this.resizeHandler()
    }

    private findNextImpl (term: string, searchOptions?: SearchOptions): SearchState {
        if (this.copyOnSelect) {
            this.preventNextOnSelectionChangeEvent = true
        }
        return this.wrapSearchResult(
            this.search.findNext(term, this.getSearchOptions(searchOptions)),
        )
    }

    private findPreviousImpl (term: string, searchOptions?: SearchOptions): SearchState {
        if (this.copyOnSelect) {
            this.preventNextOnSelectionChangeEvent = true
        }
        return this.wrapSearchResult(
            this.search.findPrevious(term, this.getSearchOptions(searchOptions)),
        )
    }

    private cancelSearchImpl (): void {
        this.search.clearDecorations()
        this.focus()
    }

    private saveStateImpl (): any {
        return this.serializeAddon.serialize({
            excludeAltBuffer: true,
            excludeModes: true,
            scrollback: 1000,
        })
    }

    private restoreStateImpl (state: string): void {
        this.xterm.write(state)
    }

    private supportsBracketedPasteImpl (): boolean {
        return this.xterm.modes.bracketedPasteMode
    }

    private isAlternateScreenActiveImpl (): boolean {
        return this.xterm.buffer.active.type === 'alternate'
    }

    // Implement the abstract methods from Frontend to delegate to our implementation
    getSelection (): string {
        return this.capabilitiesHelper.getSelection()
    }

    copySelection (): void {
        this.capabilitiesHelper.copySelection()
    }

    selectAll (): void {
        this.capabilitiesHelper.selectAll()
    }

    clearSelection (): void {
        this.capabilitiesHelper.clearSelection()
    }

    write (data: string): Promise<void> {
        return this.capabilitiesHelper.write(data)
    }

    clear (): void {
        this.capabilitiesHelper.clear()
    }

    visualBell (): void {
        this.capabilitiesHelper.visualBell()
    }

    scrollToTop (): void {
        this.capabilitiesHelper.scrollToTop()
    }

    scrollLines (amount: number): void {
        this.capabilitiesHelper.scrollLines(amount)
    }

    scrollPages (pages: number): void {
        this.capabilitiesHelper.scrollPages(pages)
    }

    scrollToBottom (): void {
        this.capabilitiesHelper.scrollToBottom()
    }

    configure (profile: BaseTerminalProfile): void {
        this.capabilitiesHelper.configure(profile)
    }

    setZoom (zoom: number): void {
        this.capabilitiesHelper.setZoom(zoom)
    }

    findNext (term: string, searchOptions?: SearchOptions): SearchState {
        return this.capabilitiesHelper.findNext(term, searchOptions)
    }

    findPrevious (term: string, searchOptions?: SearchOptions): SearchState {
        return this.capabilitiesHelper.findPrevious(term, searchOptions)
    }

    cancelSearch (): void {
        this.capabilitiesHelper.cancelSearch()
    }

    saveState (): any {
        return this.capabilitiesHelper.saveState()
    }

    restoreState (state: string): void {
        this.capabilitiesHelper.restoreState(state)
    }

    supportsBracketedPaste (): boolean {
        return this.capabilitiesHelper.supportsBracketedPaste()
    }

    isAlternateScreenActive (): boolean {
        return this.capabilitiesHelper.isAlternateScreenActive()
    }

    private configureColors (scheme: TerminalColorScheme|undefined): void {
        const appColorScheme = this.themes._getActiveColorScheme() as TerminalColorScheme

        scheme = scheme ?? appColorScheme

        const theme: ITheme = {
            foreground: scheme.foreground,
            selectionBackground: scheme.selection ?? '#88888888',
            selectionForeground: scheme.selectionForeground ?? undefined,
            background: getTerminalBackgroundColor(this.configService, this.themes, scheme) ?? '#00000000',
            cursor: scheme.cursor,
            cursorAccent: scheme.cursorAccent,
        }

        for (let i = 0; i < COLOR_NAMES.length; i++) {
            theme[COLOR_NAMES[i]] = scheme.colors[i]
        }

        if (!deepEqual(this.configuredTheme, theme)) {
            this.xterm.options.theme = theme
            this.configuredTheme = theme
        }
    }

    async attach (host: HTMLElement, profile: BaseTerminalProfile): Promise<void> {
        this.element = host

        this.xterm.open(host)
        this.opened = true

        // Work around font loading bugs
        await new Promise(resolve => setTimeout(resolve, this.hostApp.platform === Platform.Web ? 1000 : 0))

        // Just configure the colors to avoid a flash
        this.configureColors(profile.terminalColorScheme)

        if (this.enableWebGL) {
            this.webGLAddon = new WebglAddon()
            this.xterm.loadAddon(this.webGLAddon)
            this.platformService.displayMetricsChanged$.pipe(
                takeUntil(this.destroyed$),
            ).subscribe(() => {
                this.webGLAddon?.clearTextureAtlas()
            })
        } else {
            this.canvasAddon = new CanvasAddon()
            this.xterm.loadAddon(this.canvasAddon)
            this.platformService.displayMetricsChanged$.pipe(
                takeUntil(this.destroyed$),
            ).subscribe(() => {
                this.canvasAddon?.clearTextureAtlas()
            })
        }

        // Allow an animation frame
        await new Promise(r => setTimeout(r, 100))

        this.ready.next()
        this.ready.complete()

        this.xterm.loadAddon(this.search)

        this.search.onDidChangeResults(state => {
            this.searchState = state
        })

        window.addEventListener('resize', this.resizeHandler)

        this.resizeHandler()

        // Allow an animation frame
        await new Promise(r => setTimeout(r, 0))

        host.addEventListener('dragOver', (event: any) => this.dragOver.next(event))
        host.addEventListener('drop', event => this.drop.next(event))

        host.addEventListener('mousedown', event => this.mouseEvent.next(event))
        host.addEventListener('mouseup', event => this.mouseEvent.next(event))
        host.addEventListener('mousewheel', event => this.mouseEvent.next(event as MouseEvent))
        host.addEventListener('contextmenu', event => {
            event.preventDefault()
            event.stopPropagation()
        })

        this.resizeObserver = new window['ResizeObserver'](() => setTimeout(() => this.resizeHandler()))
        this.resizeObserver.observe(host)
    }

    detach (_host: HTMLElement): void {
        window.removeEventListener('resize', this.resizeHandler)
        this.resizeObserver?.disconnect()
        delete this.resizeObserver
    }

    destroy (): void {
        super.destroy()
        this.webGLAddon?.dispose()
        this.canvasAddon?.dispose()
        this.xterm.dispose()
    }

    private setFontSize () {
        const scale = Math.pow(1.1, this.zoom)
        this.xterm.options.fontSize = this.configuredFontSize * scale
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        this.xterm.options.lineHeight = Math.max(1, (this.configuredFontSize + this.configuredLinePadding * 2) / this.configuredFontSize)
        this.resizeHandler()
    }

    private getSelectionAsHTML (): string {
        return this.serializeAddon.serializeAsHTML({ includeGlobalBackground: true, onlySelection: true  })
    }

    private getSearchOptions (searchOptions?: SearchOptions): ISearchOptions {
        return {
            ...searchOptions,
            decorations: {
                matchOverviewRuler: '#888888',
                activeMatchColorOverviewRuler: '#ffff00',
                matchBackground: '#888888',
                activeMatchBackground: '#ffff00',
            },
        }
    }

    private wrapSearchResult (result: boolean): SearchState {
        if (!result) {
            return { resultCount: 0 }
        }
        return this.searchState
    }

    getCapabilities (): TerminalCapabilities {
        // Return this instance as capabilities, implementing all the required methods
        return {
            // Search capabilities
            findNext: this.findNext.bind(this),
            findPrevious: this.findPrevious.bind(this),
            cancelSearch: this.cancelSearch.bind(this),

            // Scroll capabilities
            scrollToTop: this.scrollToTop.bind(this),
            scrollLines: this.scrollLines.bind(this),
            scrollPages: this.scrollPages.bind(this),
            scrollToBottom: this.scrollToBottom.bind(this),

            // Selection capabilities
            getSelection: this.getSelection.bind(this),
            copySelection: this.copySelection.bind(this),
            selectAll: this.selectAll.bind(this),
            clearSelection: this.clearSelection.bind(this),

            // IO capabilities
            write: this.write.bind(this),
            clear: this.clear.bind(this),
            visualBell: this.visualBell.bind(this),

            // Configuration capabilities
            configure: this.configure.bind(this),
            setZoom: this.setZoom.bind(this),

            // State capabilities
            saveState: this.saveState.bind(this),
            restoreState: this.restoreState.bind(this),
            supportsBracketedPaste: this.supportsBracketedPaste.bind(this),
            isAlternateScreenActive: this.isAlternateScreenActive.bind(this),
        }
    }
}

/** @hidden */
export class XTermWebGLFrontend extends XTermFrontend {
    protected enableWebGL = true
}
