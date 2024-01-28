/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This widget, allows easy creation of a call UI, that automatically handles situation where the user dismisses the UI
 */



import CallWidget from "./widget.mjs";
import PopupMenu from "/$/system/static/html-hc/widgets/popup-menu/popup.mjs";




export default class CallPopup extends PopupMenu {

    /**
     * 
     * @param {ConstructorParameters<typeof CallWidget>['0']} args 
     */
    constructor(args) {
        const main = new CallWidget(args);
        super(
            {
                content: main.html
            }
        );

        main.destroySignal.addEventListener('abort', () => {
            this.destroy()
        }, { once: true, signal: this.destroySignal })

        this.addEventListener('prehide', () => {
            if (!main.destroySignal.aborted) {
                main.compact = true;
            }
        }, { signal: this.destroySignal })
        this.addEventListener('hide', () => {
            if (!main.destroySignal.aborted) {
                main.html.remove()
                document.body.prepend(main.html)
            }
        }, { signal: this.destroySignal })
    }
}