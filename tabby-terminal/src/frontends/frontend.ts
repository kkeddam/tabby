import { Injector } from '@angular/core'
import { Observable, Subject, AsyncSubject, ReplaySubject, BehaviorSubject } from 'rxjs'
import { BaseTerminalProfile, ResizeEvent } from '../api/interfaces'

export interface SearchOptions {
    regex?: boolean
    wholeWord?: boolean
    caseSensitive?: boolean
    incremental?: true
}

export interface SearchState {
    resultIndex?: number
    resultCount: number
}

/**
 * Terminal capabilities interface (consolidated to reduce Fan-In)
 */
export interface TerminalCapabilities {
    // Search capabilities
    findNext: (term: string, searchOptions?: SearchOptions) => SearchState
    findPrevious: (term: string, searchOptions?: SearchOptions) => SearchState
    cancelSearch: () => void

    // Scroll capabilities
    scrollToTop: () => void
    scrollLines: (amount: number) => void
    scrollPages: (pages: number) => void
    scrollToBottom: () => void

    // Selection capabilities
    getSelection: () => string
    copySelection: () => void
    selectAll: () => void
    clearSelection: () => void

    // IO capabilities
    write: (data: string) => Promise<void>
    clear: () => void
    visualBell: () => void

    // Configuration capabilities
    configure: (profile: BaseTerminalProfile) => void
    setZoom: (zoom: number) => void

    // State capabilities
    saveState: () => any
    restoreState: (state: string) => void
    supportsBracketedPaste: () => boolean
    isAlternateScreenActive: () => boolean
}

/**
 * Base class for terminal frontends
 */
export abstract class Frontend {
    enableResizing = true
    protected ready = new AsyncSubject<void>()
    protected title = new ReplaySubject<string>(1)
    protected alternateScreenActive = new BehaviorSubject<boolean>(false)
    protected mouseEvent = new Subject<MouseEvent>()
    protected bell = new Subject<void>()
    protected contentUpdated = new Subject<void>()
    protected input = new Subject<Buffer>()
    protected resize = new ReplaySubject<ResizeEvent>(1)
    protected dragOver = new Subject<DragEvent>()
    protected drop = new Subject<DragEvent>()
    protected destroyed = new Subject<void>()

    get ready$ (): Observable<void> { return this.ready }
    get title$ (): Observable<string> { return this.title }
    get alternateScreenActive$ (): Observable<boolean> { return this.alternateScreenActive }
    get mouseEvent$ (): Observable<MouseEvent> { return this.mouseEvent }
    get bell$ (): Observable<void> { return this.bell }
    get contentUpdated$ (): Observable<void> { return this.contentUpdated }
    get input$ (): Observable<Buffer> { return this.input }
    get resize$ (): Observable<ResizeEvent> { return this.resize }
    get dragOver$ (): Observable<DragEvent> { return this.dragOver }
    get drop$ (): Observable<DragEvent> { return this.drop }
    get destroyed$ (): Observable<void> { return this.destroyed }

    constructor (protected injector: Injector) { }

    destroy (): void {
        this.destroyed.next()
        for (const o of [
            this.ready,
            this.title,
            this.alternateScreenActive,
            this.mouseEvent,
            this.bell,
            this.contentUpdated,
            this.input,
            this.resize,
            this.dragOver,
            this.drop,
            this.destroyed,
        ]) {
            o.complete()
        }
    }

    abstract attach (host: HTMLElement, profile: BaseTerminalProfile): Promise<void>
    detach (host: HTMLElement): void { } // eslint-disable-line
    abstract focus (): void

    // Terminal capabilities implementation
    abstract getCapabilities (): TerminalCapabilities

    // Search capabilities
    findNext (term: string, searchOptions?: SearchOptions): SearchState {
        return this.getCapabilities().findNext(term, searchOptions)
    }

    findPrevious (term: string, searchOptions?: SearchOptions): SearchState {
        return this.getCapabilities().findPrevious(term, searchOptions)
    }

    cancelSearch (): void {
        this.getCapabilities().cancelSearch()
    }

    // Scroll capabilities
    scrollToTop (): void {
        this.getCapabilities().scrollToTop()
    }

    scrollLines (amount: number): void {
        this.getCapabilities().scrollLines(amount)
    }

    scrollPages (pages: number): void {
        this.getCapabilities().scrollPages(pages)
    }

    scrollToBottom (): void {
        this.getCapabilities().scrollToBottom()
    }

    // Selection capabilities
    getSelection (): string {
        return this.getCapabilities().getSelection()
    }

    copySelection (): void {
        this.getCapabilities().copySelection()
    }

    selectAll (): void {
        this.getCapabilities().selectAll()
    }

    clearSelection (): void {
        this.getCapabilities().clearSelection()
    }

    // IO capabilities
    write (data: string): Promise<void> {
        return this.getCapabilities().write(data)
    }

    clear (): void {
        this.getCapabilities().clear()
    }

    visualBell (): void {
        this.getCapabilities().visualBell()
    }

    // Configuration capabilities
    configure (profile: BaseTerminalProfile): void {
        this.getCapabilities().configure(profile)
    }

    setZoom (zoom: number): void {
        this.getCapabilities().setZoom(zoom)
    }

    // State capabilities
    saveState (): any {
        return this.getCapabilities().saveState()
    }

    restoreState (state: string): void {
        this.getCapabilities().restoreState(state)
    }

    supportsBracketedPaste (): boolean {
        return this.getCapabilities().supportsBracketedPaste()
    }

    isAlternateScreenActive (): boolean {
        return this.getCapabilities().isAlternateScreenActive()
    }
}
