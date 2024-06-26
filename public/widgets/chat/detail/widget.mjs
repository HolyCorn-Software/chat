/**
 * Copyright 2024 HolyCorn Software
 * The Chat Faculty
 * This widget, shows details about a chat's profile.
 * It allows openings for other components to display equally vital info.
 */

import hcRpc from "/$/system/static/comm/rpc/aggregate-rpc.mjs";
import { Widget, hc } from "/$/system/static/html-hc/lib/widget/index.mjs";
import ActionButton from "/$/system/static/html-hc/widgets/action-button/button.mjs";
import BrandedBinaryPopup from "/$/system/static/html-hc/widgets/branded-binary-popup/widget.mjs";
import EventBasedExtender from "/$/system/static/run/event-based-extender.mjs";



export default class ChatProfileDetail extends Widget {


    /**
     * 
     * @param {telep.chat.management.Chat} chat 
     */
    constructor(chat) {
        super();

        super.html = hc.spawn(
            {
                classes: ChatProfileDetail.classList,
                innerHTML: `
                    <div class='container'>
                        <div class='main'>
                            <div class='profile'>
                                <div class='img'></div>
                            </div>
                        </div>
                        <div class='extras'></div>
                        <div class='exit'></div>
                    </div>
                
                `
            }
        );

        const img = Symbol()
        this.defineImageProperty(
            {
                selector: '.container >.main >.profile >.img',
                property: img,
                fallback: '/$/shared/static/logo.png',
                mode: 'background',
            }
        );

        this[img] = chat.icon

        /** @type {ExtrasView} */ this.extras
        this.widgetProperty(
            {
                selector: ['', ...ExtrasView.classList].join('.'),
                parentSelector: ':scope >.container >.extras',
                childType: 'widget',
            },
            'extras'
        );

        this.extras = new ExtrasView(chat)

        const canExit = async () => {
            if (chat.type == 'private') return false; // No one can exit a private chat

            if (chat.type == 'roled' && chat.role?.member != await (async () => {
                return (await hcRpc.modernuser.authentication.whoami()).id
            })()) {
                return; // In a roled chat, only the role player can exit
            }

            return true
        }

        const btnExit = new ActionButton({
            content: `Exit Chat`,
            hoverAnimate: false,
            onclick: async () => {
                if (!await canExit()) return;
                new BrandedBinaryPopup({
                    title: `Exit`,
                    question: `Do you really want to leave this chat?\nThe other person would see that you left.\nYou might be able to rejoin, by sending a message.`,
                    positive: `Yes`,
                    negative: `No`,
                    execute: async () => {
                        await hcRpc.chat.management.exit({ id: chat.id })
                        this.html.classList.remove('can-exit')
                    }
                }).show()
            }
        })

        this.blockWithAction(async () => {
            await this.html.classList.toggle('can-exit', await canExit())
        })

        this.html.$(':scope >.container >.exit').appendChild(btnExit.html)


    }

    /**
     * @readonly
     */
    static get classList() {
        return ['hc-telep-chat-widget-profile-detail']
    }

}




class ExtrasView extends Widget {

    /**
     * 
     * @param {telep.chat.management.Chat} chat 
     */
    constructor(chat) {
        super();

        this.html = hc.spawn(
            {
                classes: ExtrasView.classList,
                innerHTML: `
                    <div class='container'>
                        <div class='content'></div>
                    </div>
                `
            }
        );

        /** @type {HTMLElement[]} */ this.content
        this.pluralWidgetProperty(
            {
                selector: '*',
                parentSelector: ':scope >.container >.content',
                childType: 'html',
            },
            'content'
        )

        const extender = new EventBasedExtender(
            {
                eventName: 'telep-chat-show-profile-detail',
                runScope: 'telep-chat-messaging-profile-addons',
            }
        );

        this.blockWithAction(async () => {
            await extender.fetch(
                {
                    callback: async (promise) => {
                        const widget = new Widget();
                        widget.html = hc.spawn({})
                        this.content.push(widget.html)
                        widget.loadWhilePromise(promise).then(results => {
                            if (!results) return;
                            widget.html.appendChild(results.html)
                        })
                    },
                    data: {
                        chat
                    }
                }
            );
        })

    }


    /**
     * @readonly
     */
    static get classList() {
        return ['hc-telep-chat-widget-profile-detail-extras']
    }


}