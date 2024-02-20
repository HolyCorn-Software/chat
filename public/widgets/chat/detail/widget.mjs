/**
 * Copyright 2024 HolyCorn Software
 * The Chat Faculty
 * This widget, shows details about a chat's profile.
 * It allows openings for other components to display equally vital info.
 */

import { Widget, hc } from "/$/system/static/html-hc/lib/widget/index.mjs";
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
                        widget.loadWhilePromise(promise).then(results => widget.html.appendChild(results.html))
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