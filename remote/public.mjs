/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This module in the Chat Faculty, allows public clients access to some methods,
 * over RPC
 */

import { CallingPublicMethods } from "../calling/remote/public.mjs";
import ChatController from "../controller.mjs";
import ChatEventsPublicMethods from "../events/remote/public.mjs";
import ChatManagementPublicMethods from "../management/remote/public.mjs";
import MessagingPublicMethods from "../messaging/remote/public.mjs";


export default class ChatPublicMethods extends FacultyPublicMethods {

    /**
     * 
     * @param {ChatController} controller 
     */
    constructor(controller) {
        super()

        this.messaging = new MessagingPublicMethods(controller.messaging)
        this.events = new ChatEventsPublicMethods(controller.events)
        this.management = new ChatManagementPublicMethods(controller.management)
        this.calling = new CallingPublicMethods(controller.calling)

    }

}