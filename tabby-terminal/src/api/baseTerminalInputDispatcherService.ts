import { Injectable } from '@angular/core'
import { Buffer } from 'buffer'
import type { BaseSession, Frontend } from 'tabby-terminal'

export interface SendInputContext {
    data: string | Buffer
    session?: BaseSession | null
    frontend?: Frontend | null
    scrollOnInput: boolean
}

@Injectable({ providedIn: 'root' })
export class BaseTerminalInputDispatcherService {
    sendInput ({ data, session, frontend, scrollOnInput }: SendInputContext): void {
        if (!(data instanceof Buffer)) {
            data = Buffer.from(data, 'utf-8')
        }

        session?.feedFromTerminal(data)

        if (scrollOnInput) {
            frontend?.scrollToBottom()
        }
    }
}
