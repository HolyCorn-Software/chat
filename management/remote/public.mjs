/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This module provides access to features related to management of chats, to clients over the public web.
 */

import muser_common from "muser_common";
import ChatManagement from "../controller.mjs";


export default class ChatManagementPublicMethods extends muser_common.UseridAuthProxy.createClass(ChatManagement.prototype) {

    /**
     * 
     * @param {ChatManagement} controller 
     */
    constructor(controller) {
        super(controller)
    }

    async createChat() {
        throw new Exception(`Sorry, you can't create a chat, just like that.`)
    }

    async createChatRole() {
        throw new Exception(`Sorry, you can't call 'createChatRole()', just like that.`)
    }

    async addUserToRole() {
        throw new Exception(`Sorry, you can't call 'addUserToRole()', just like that.`)
    }
    async removeUserFromRole() {
        throw new Exception(`Sorry, you can't call 'removeUserFromRole()', just like that.`)
    }

    get events() {
        return undefined
    }

}