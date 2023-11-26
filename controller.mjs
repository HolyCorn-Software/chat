/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This controller is the main module of the faculty
 */

import ChatCallingController from "./calling/controller.mjs"
import ChatEventsController from "./events/controller.mjs"
import ChatManagement from "./management/controller.mjs"
import MessagingController from "./messaging/controller.mjs"

const collections = Symbol()

export default class ChatController {

    /**
     * 
     * @param {telep.chat.management.Collections} _collections 
     */
    constructor(_collections) {
        this[collections] = _collections

        this.management = new ChatManagement(this[collections].chats)


        this.events = new ChatEventsController({
            management: this.management
        })

        this.messaging = new MessagingController({
            collections: this[collections].messaging,
            controllers: {
                management: this.management,
                events: this.events
            }
        });

        this.calling = new ChatCallingController(
            {
                events: this.events,
                management: this.management
            }
        )
    }



}