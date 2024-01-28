/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This widget allows a user to interact with a chat
 */

import CallPopup from "/$/chat/calling/static/widgets/call/popup.mjs";
import ChatMessaging from "/$/chat/messaging/static/widgets/chat-messaging/widget.mjs";
import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import { Widget, hc } from "/$/system/static/html-hc/lib/widget/index.mjs";
import BrandedBinaryPopup from "/$/system/static/html-hc/widgets/branded-binary-popup/widget.mjs";


export default class ChatWidget extends Widget {


    /**
     * 
     * @param {telep.chat.ChatMetadata} chat 
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
                                        new CallPopup({ chat: this.chat, type }).show();
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

        this.blockWithAction(async () => {
            await this.load()
        })

    }

    async load() {

        if (!this.chat.label || !this.chat.icon) {
            Object.assign(this.chat, await hcRpc.chat.management.getChatViewData({ id: this.chat.id }))
        }
        this.html.$('.container >.action-bar >.main >.middle >.chat-label').innerHTML = this.chat.label
        this.html.style.setProperty('--chat-icon', `url("${this.chat.icon}")`)


    }

    static get classList() {
        return ['hc-telep-chat-widget']
    }

}