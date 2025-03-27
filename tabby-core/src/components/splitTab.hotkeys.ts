import { SplitTabComponent } from './splitTab.component'
import { SplitDirection, ResizeDirection } from './splitTab.models'

/**
 * Crée un dictionnaire des raccourcis clavier pour SplitTabComponent
 */
export function createHotkeyActions(instance: SplitTabComponent): Record<string, () => void> {
    return {
        'split-right': () => instance.splitTab(instance.getFocusedTab()!, 'r'),
        'split-bottom': () => instance.splitTab(instance.getFocusedTab()!, 'b'),
        'split-top': () => instance.splitTab(instance.getFocusedTab()!, 't'),
        'split-left': () => instance.splitTab(instance.getFocusedTab()!, 'l'),

        'pane-nav-left': () => instance.navigate('l'),
        'pane-nav-right': () => instance.navigate('r'),
        'pane-nav-up': () => instance.navigate('t'),
        'pane-nav-down': () => instance.navigate('b'),

        'pane-nav-previous': () => instance.navigateLinear(-1),
        'pane-nav-next': () => instance.navigateLinear(1),

        'pane-nav-1': () => instance.navigateSpecific(0),
        'pane-nav-2': () => instance.navigateSpecific(1),
        'pane-nav-3': () => instance.navigateSpecific(2),
        'pane-nav-4': () => instance.navigateSpecific(3),
        'pane-nav-5': () => instance.navigateSpecific(4),
        'pane-nav-6': () => instance.navigateSpecific(5),
        'pane-nav-7': () => instance.navigateSpecific(6),
        'pane-nav-8': () => instance.navigateSpecific(7),
        'pane-nav-9': () => instance.navigateSpecific(8),

        'pane-maximize': () => {
            const focused = instance.getFocusedTab()
            if (focused) {
                if (instance.getMaximizedTab()) {
                    instance.maximize(null)
                } else if (instance.getAllTabs().length > 1) {
                    instance.maximize(focused)
                }
            }
        },

        'close-pane': () => {
            const focused = instance.getFocusedTab()
            if (focused) instance.removeTab(focused)
        },

        'pane-increase-vertical': () => instance.resizePane('v'),
        'pane-decrease-vertical': () => instance.resizePane('dv'),
        'pane-increase-horizontal': () => instance.resizePane('h'),
        'pane-decrease-horizontal': () => instance.resizePane('dh'),
    }
}
