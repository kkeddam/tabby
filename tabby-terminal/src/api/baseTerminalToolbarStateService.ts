import { Injectable } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class BaseTerminalToolbarStateService {
    constructor (
        private toolbarRevealTimeout: { set: () => void; clear: () => void },
        private getPinned: () => boolean,
        private setPinned: (val: boolean) => void,
        private setRevealToolbar: (val: boolean) => void,
    ) {}

    hideToolbar (): void {
        this.toolbarRevealTimeout.set()
    }

    showToolbar (): void {
        this.setRevealToolbar(true)
        this.toolbarRevealTimeout.clear()
    }

    togglePin (): void {
        const newState = !this.getPinned()
        this.setPinned(newState)
        window.localStorage.pinTerminalToolbar = newState.toString()
    }

    initializeFromStorage (): boolean {
        const stored = window.localStorage.pinTerminalToolbar
        return stored === 'true'
    }
}
