/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This module (public), makes it possible to access methods related to chat events management
 */

import EventChannelPublicMethods from "../../../../system/public/comm/rpc/json-rpc/event-channel/server/public.mjs";
import ChatEventsController from "../controller.mjs";



/**
 * @extends EventChannelPublicMethods<undefined>
 */
export default class ChatEventsPublicMethods extends Object {

    /**
     * 
     * @param {ChatEventsController} controller 
     */
    constructor(controller) {
        super()

        return new Proxy(this, {
            get: (target, property, receiver) => {
                return Reflect.get(target, property, receiver) || Reflect.get(controller.public, property, receiver)
            }
        })
    }


}