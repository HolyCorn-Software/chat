/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This widget allows a user to interact with a chat
 */

import CallWidget from "/$/chat/calling/static/widgets/call/widget.mjs";
import ChatMessaging from "/$/chat/messaging/static/widgets/chat-messaging/widget.mjs";
import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import { handle } from "/$/system/static/errors/error.mjs";
import { Widget, hc } from "/$/system/static/html-hc/lib/widget/index.mjs";
import BrandedBinaryPopup from "/$/system/static/html-hc/widgets/branded-binary-popup/widget.mjs";
import PopupMenu from "/$/system/static/html-hc/widgets/popup-menu/popup.mjs";


/**
 * @extends Widget<ChatWidget>
 */
export default class ChatWidget extends Widget {


    /**
     * 
     * @param {string} chat 
     */
    constructor(chat) {
        super();

        super.html = hc.spawn(
            {
                classes: ChatWidget.classList,
                innerHTML: `
                    <div class='container'>

                        <div class='action-bar'>
                            <div class='main'>
                                <div class='left'>
                                    <div class='profile-image'></div>
                                </div>

                                <div class='middle'>
                                    <div class='chat-label'>Some Chat</div>
                                </div>

                                <div class='right'>
                                    <div class='actions'></div>
                                </div>
                            </div>
                        </div>

                        <div class='messaging-ui'></div>
                        
                    </div>
                `
            }
        );

        this.widgetProperty(
            {
                selector: ['', ...ChatMessaging.classList].join('.'),
                parentSelector: '.container >.messaging-ui',
                childType: 'widget',
                property: 'messaging',
            }
        )
        /** @type {ChatMessaging} */ this.messaging = new ChatMessaging({ chat })

        // Now, for the call actions

        /** @type {telep.chat.calling.CallType} */
        const callTypes = ['video', 'voice',]

        for (const type of callTypes) {
            const property = Symbol()
            this.html.$('.container >.action-bar >.main >.right >.actions').appendChild(
                hc.spawn(
                    {
                        classes: ['call', type],
                        onclick: () => {
                            new BrandedBinaryPopup(
                                {
                                    title: `Place Call`,
                                    question: `Do you want to make a ${type} call?`,
                                    positive: `Yes`,
                                    negative: `No`,
                                    execute: async () => {
                                        console.log(`The chat id is `, chat)
                                        new PopupMenu(
                                            {
                                                content: new CallWidget({ chat, type }).html
                                            }
                                        ).show()
                                    }
                                }
                            ).show()
                        }
                    }
                )
            )

            this.defineImageProperty(
                {
                    selector: `.container >.action-bar >.main >.right >.actions >.call.${type}`,
                    mode: 'inline',
                    property,
                    cwd: import.meta.url
                }
            );

            this[property] = `./res/${type}-call.svg`


        }


        this.chat = chat

        this.waitTillDOMAttached().then(() => {
            // TODO: Create a retry strategy
            this.load().catch(e => handle(e))
        })

    }

    async load() {
        return await this.loadWhilePromise(
            (async () => {
                const data = await hcRpc.chat.management.getChatViewData({ id: this.chat })
                this.html.$('.container >.action-bar >.main >.middle >.chat-label').innerHTML = data.label
                this.html.style.setProperty('--chat-icon', `url("${data.icon}")`)
            })()
        )

    }

    static get classList() {
        return ['hc-telep-chat-widget']
    }

}