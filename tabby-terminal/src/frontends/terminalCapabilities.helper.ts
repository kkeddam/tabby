import { BaseTerminalProfile } from '../api/interfaces'
import { SearchOptions, SearchState, Frontend } from './frontend'

/**
 * Helper class to reduce Fan-In by providing a composition-based approach
 * for implementing terminal capabilities.
 *
 * This is used internally by terminal frontend implementations but does not
 * change the public API to maintain compatibility.
 */
export class TerminalCapabilitiesHelper {
    constructor (
        private implementation: {
            findNext: (term: string, searchOptions?: SearchOptions) => SearchState;
            findPrevious: (term: string, searchOptions?: SearchOptions) => SearchState;
            cancelSearch: () => void;
            scrollToTop: () => void;
            scrollLines: (amount: number) => void;
            scrollPages: (pages: number) => void;
            scrollToBottom: () => void;
            getSelection: () => string;
            copySelection: () => void;
            selectAll: () => void;
            clearSelection: () => void;
            write: (data: string) => Promise<void>;
            clear: () => void;
            visualBell: () => void;
            configure: (profile: BaseTerminalProfile) => void;
            setZoom: (zoom: number) => void;
            saveState: () => any;
            restoreState: (state: string) => void;
            supportsBracketedPaste: () => boolean;
            isAlternateScreenActive: () => boolean;
        },
    ) {}

    // Simple delegation methods with minimal overhead
    findNext (term: string, searchOptions?: SearchOptions): SearchState {
        return this.implementation.findNext(term, searchOptions)
    }

    findPrevious (term: string, searchOptions?: SearchOptions): SearchState {
        return this.implementation.findPrevious(term, searchOptions)
    }

    cancelSearch (): void {
        this.implementation.cancelSearch()
    }

    scrollToTop (): void {
        this.implementation.scrollToTop()
    }

    scrollLines (amount: number): void {
        this.implementation.scrollLines(amount)
    }

    scrollPages (pages: number): void {
        this.implementation.scrollPages(pages)
    }

    scrollToBottom (): void {
        this.implementation.scrollToBottom()
    }

    getSelection (): string {
        return this.implementation.getSelection()
    }

    copySelection (): void {
        this.implementation.copySelection()
    }

    selectAll (): void {
        this.implementation.selectAll()
    }

    clearSelection (): void {
        this.implementation.clearSelection()
    }

    write (data: string): Promise<void> {
        return this.implementation.write(data)
    }

    clear (): void {
        this.implementation.clear()
    }

    visualBell (): void {
        this.implementation.visualBell()
    }

    configure (profile: BaseTerminalProfile): void {
        this.implementation.configure(profile)
    }

    setZoom (zoom: number): void {
        this.implementation.setZoom(zoom)
    }

    saveState (): any {
        return this.implementation.saveState()
    }

    restoreState (state: string): void {
        this.implementation.restoreState(state)
    }

    supportsBracketedPaste (): boolean {
        return this.implementation.supportsBracketedPaste()
    }

    isAlternateScreenActive (): boolean {
        return this.implementation.isAlternateScreenActive()
    }

    /**
     * Apply the capabilities to a Frontend instance
     */
    applyTo (frontend: Frontend): void {
        // Use method binding to implement the Frontend interface
        // This reduces Fan-In by using composition instead of inheritance
        const methods = [
            'findNext', 'findPrevious', 'cancelSearch',
            'scrollToTop', 'scrollLines', 'scrollPages', 'scrollToBottom',
            'getSelection', 'copySelection', 'selectAll', 'clearSelection',
            'write', 'clear', 'visualBell',
            'configure', 'setZoom',
            'saveState', 'restoreState', 'supportsBracketedPaste', 'isAlternateScreenActive',
        ]

        for (const method of methods) {
            frontend[method] = this[method].bind(this)
        }
    }
}
