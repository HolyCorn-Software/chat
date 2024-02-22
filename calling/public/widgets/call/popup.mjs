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
        /** @type {CallWidget} */
        const main = arguments[1] || new CallWidget(args);
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


            }
        }, { signal: this.destroySignal })
        this.addEventListener('hide', () => {
            if (!main.destroySignal.aborted) {
                main.html.remove()

                setTimeout(() => {
                    main.compact = true;
                    document.body.prepend(main.html)
                }, 500)

                main.html.addEventListener('click', () => {
                    main.compact = false;
                    new CallPopup(undefined, main).show()
                }, { once: true })
            }
        }, { signal: this.destroySignal })
    }
}