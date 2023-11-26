/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This module allows other faculties with features related to managing chats
 */

import ChatManagement from "../controller.mjs";



/**
 * @extends ChatManagement
 */
export default class ChatManagementInternalMethods extends FunctionProxy.SkipArgOne {

    /**
     * 
     * @param {ChatManagement} controller 
     */
    constructor(controller) {
        super(controller)
    }

}