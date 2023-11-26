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

}