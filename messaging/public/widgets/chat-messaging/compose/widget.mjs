/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This widget (compose), is part of the chat-messaging widget, and allows a user
 * to compose a new message
 */


import DelayedAction from "/$/system/static/html-hc/lib/util/delayed-action/action.mjs";
import { Widget, hc } from "/$/system/static/html-hc/lib/widget/index.mjs";
/**
 * This widget is part of the chat-messaging widget, and allows the user to compose a new message 
 * @extends Widget<ChatMessagingCompose>
 */
export default class ChatMessagingCompose extends Widget {


    constructor() {

        super();

        super.html = hc.spawn({
            classes: ChatMessagingCompose.classList,
            innerHTML: `
                <div class='container'>
                    <div class='main'>
                        <div class='additional-trigger'></div>
                        <div class='text-box'>
                            <div contenteditable="true"></div>
                        </div>
                        <div class='send-action'></div>
                    </div>

                    <div class='additional-ui'>
                        Add something else, like a video, image, audio
                    </div>
                </div>
            `
        });

        const sendImgSymbol = Symbol()
        this.defineImageProperty(
            {
                selector: '.container >.main >.send-action',
                mode: 'inline',
                property: sendImgSymbol,
                cwd: import.meta.url
            }
        );

        this[sendImgSymbol] = './res/send.svg'

        this.html.$('.container >.main >.send-action').addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('composed'))
        })
        /** @type {(event: "composed", cb: (event: CustomEvent)=> void )=> void} */ this.addEventListener



        this.html.$('.container >.main >.additional-trigger').addEventListener('click',
            () => {
                // When clicked, let's show the attachment UI
                this.html.classList.toggle('show-trigger-ui')

            }
        );



        const triggerImg = Symbol();
        this.defineImageProperty(
            {
                selector: '.container >.main >.additional-trigger',
                property: triggerImg,
                mode: 'inline',
                cwd: import.meta.url
            }
        );
        this[triggerImg] = './res/paperclip.svg'

        /** @type {HTMLElement} */ this.textBox
        this.widgetProperty(
            {
                selector: 'div',
                parentSelector: '.container >.main >.text-box',
                property: 'textBox',
                childType: 'html',
                immediate: true
            }
        )


        const onTextChange = new DelayedAction(() => {

            const regexpG = /([^>a-zA-Z0-9]|^| )(HolyCorn)/g;
            const regexp = /([^>a-zA-Z0-9]|^| )(HolyCorn)/
            let next;


            /**
             * 
             * @returns {HTMLElement}
             */
            const getLastSpace = () => {
                const lastChild = [...this.textBox.children].at(-1)
                if (lastChild?.innerHTML === ' ' || lastChild?.innerHTML === '') {
                    return lastChild
                }
                const child = document.createElement('div')
                child.innerHTML = ''
                this.textBox.appendChild(child)
                return child
            }

            function focusNext() {
                const element = getLastSpace()
                const range = document.createRange()

                const selection = window.getSelection()

                range.setStart(element, 0)
                range.setEnd(element, 0)

                selection.removeAllRanges()
                selection.addRange(range)
                element.remove()
            }


            const nodes = this.textBox.querySelectorAll(':scope >.holycorn-node');

            for (const matches = this.textBox.innerHTML.matchAll(regexpG); !(next = matches.next()).done;) {
                this.textBox.innerHTML = this.textBox.innerHTML.replaceAll(next.value[0], `${next.value[1]}<div class='holycorn-node'>${next.value[2]}</div>`);
                focusNext()
            }


            nodes.forEach(x => {
                if (!regexp.test(x.textContent) && !regexpG.test(x.textContent)) {
                    x.outerHTML = x.innerHTML
                }
            });


        }, 250);

        // new MutationObserver(onTextChange).observe(this.textboxContent, { childList: true, subtree: true })
        this.textBox.parentElement.addEventListener('input', onTextChange)

    }

    /**
     * @returns {Omit<telep.chat.messaging.MessageInit, "userid"|"chat">}
     */
    get value() {
        return {
            type: 'text',
            data: {
                text: this.textBox.innerText
            }
        }
    }
    clear() {
        this.textBox.innerText = ''
    }


    /**
     * @readonly
     */
    static get classList() {
        return ['hc-telep-chat-messaging-compose'];
    }

}


