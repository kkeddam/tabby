import { Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { Platform } from 'tabby-core'

export interface BaseTerminalTabHotkeyContext {
    untilDestroyed: <T>(obs$: Observable<T>, fn: (val: T) => void) => void
    hotkey$: Observable<string>
    hasFocus: () => boolean
    copySelection: () => void
    clearSelection: () => void
    paste: () => void
    selectAll: () => void
    clearTerminal: () => void
    zoomIn: () => void
    zoomOut: () => void
    resetZoom: () => void
    sendInput: (input: string) => void
    sendPlatformInput: (platformMap: Record<string, string>) => void
    copyCurrentPath: () => void
    scrollLines: (lines: number) => void
    scrollPages: (pages: number) => void
    scrollToTop: () => void
    scrollToBottom: () => void
    notify: (msg: string) => void
    translate: (msg: string) => string
    getSelection: () => string
}

@Injectable({ providedIn: 'root' })
export class BaseTerminalTabHotkeyHandlerService {
    initialize(context: BaseTerminalTabHotkeyContext): void {
        const {
            untilDestroyed,
            hotkey$,
            hasFocus,
            copySelection,
            clearSelection,
            paste,
            selectAll,
            clearTerminal,
            zoomIn,
            zoomOut,
            resetZoom,
            sendInput,
            sendPlatformInput,
            copyCurrentPath,
            scrollLines,
            scrollPages,
            scrollToTop,
            scrollToBottom,
            notify,
            translate,
            getSelection,
        } = context

        untilDestroyed(hotkey$, hotkey => {
            if (!hasFocus()) return

            switch (hotkey) {
                case 'ctrl-c':
                    if (getSelection()) {
                        copySelection()
                        clearSelection()
                        notify(translate('Copied'))
                    } else {
                        sendInput('\x03')
                    }
                    break
                case 'copy':
                    copySelection()
                    clearSelection()
                    notify(translate('Copied'))
                    break
                case 'paste':
                    paste()
                    break
                case 'select-all':
                    selectAll()
                    break
                case 'clear':
                    clearTerminal()
                    break
                case 'zoom-in':
                    zoomIn()
                    break
                case 'zoom-out':
                    zoomOut()
                    break
                case 'reset-zoom':
                    resetZoom()
                    break
                case 'previous-word':
                    sendPlatformInput({
                        [Platform.Windows]: '\x1b[1;5D',
                        [Platform.macOS]: '\x1bb',
                        [Platform.Linux]: '\x1bb',
                    })
                    break
                case 'next-word':
                    sendPlatformInput({
                        [Platform.Windows]: '\x1b[1;5C',
                        [Platform.macOS]: '\x1bf',
                        [Platform.Linux]: '\x1bf',
                    })
                    break
                case 'delete-line':
                    sendInput('\x1bw')
                    break
                case 'delete-previous-word':
                    sendInput('\u0017')
                    break
                case 'delete-next-word':
                    sendPlatformInput({
                        [Platform.Windows]: '\x1bd\x1b[3;5~',
                        [Platform.macOS]: '\x1bd',
                        [Platform.Linux]: '\x1bd',
                    })
                    break
                case 'copy-current-path':
                    copyCurrentPath()
                    break
                case 'scroll-to-top':
                    scrollToTop()
                    break
                case 'scroll-page-up':
                    scrollPages(-1)
                    break
                case 'scroll-up':
                    scrollLines(-1)
                    break
                case 'scroll-down':
                    scrollLines(1)
                    break
                case 'scroll-page-down':
                    scrollPages(1)
                    break
                case 'scroll-to-bottom':
                    scrollToBottom()
                    break
            }
        })
    }
}
