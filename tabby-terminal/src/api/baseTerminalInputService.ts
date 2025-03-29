import { Injectable } from '@angular/core'
import { PlatformService, HostAppService, TranslateService, ConfigService, Platform } from 'tabby-core'

@Injectable({ providedIn: 'root' })
export class BaseTerminalInputService {
    constructor (
        private platform: PlatformService,
        private hostApp: HostAppService,
        private translate: TranslateService,
        private config: ConfigService,
    ) {}

    async preparePasteData (rawData: string): Promise<string | null> {
        let data = rawData

        // Normalize line endings
        if (this.hostApp.platform === Platform.Windows) {
            data = data.replaceAll('\r\n', '\r')
        } else {
            data = data.replaceAll('\n', '\r')
        }

        // Handle trimming logic
        if (this.config.store.terminal.trimWhitespaceOnPaste && data.indexOf('\n') === data.length - 1) {
            data = data.substring(0, data.length - 1)
        }

        // Warn on multiline paste
        if (!data.includes('\r')) {
            if (this.config.store.terminal.trimWhitespaceOnPaste) {
                data = data.trim()
            }
        } else if (this.config.store.terminal.warnOnMultilinePaste) {
            const result = (await this.platform.showMessageBox({
                type: 'warning',
                detail: data.slice(0, 1000),
                message: this.translate.instant('Paste multiple lines?'),
                buttons: [
                    this.translate.instant('Paste'),
                    this.translate.instant('Cancel'),
                ],
                defaultId: 0,
                cancelId: 1,
            })).response

            if (result === 1) { return null }
        }

        return data
    }

    wrapBracketedPaste (data: string, supportsBracketedPaste: boolean): string {
        if (this.config.store.terminal.bracketedPaste && supportsBracketedPaste) {
            return `\x1b[200~${data}\x1b[201~`
        }
        return data
    }

    detectProgress (data: string): number | null {
        if (!this.config.store.terminal.detectProgress) { return null }
        const match = /(^|[^\d])(\d+(\.\d+)?)%([^\d]|$)/.exec(data)
        if (match) {
            return match[3] ? parseFloat(match[2]) : parseInt(match[2])
        }
        return null
    }
}
