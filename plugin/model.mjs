/**
 * Copyright 2024 HolyCorn Software
 * The Faculty of Chat
 * This module (model), defines a format for plugins that extend calling functionality
 */

import ChatController from "../controller.mjs"



/**
 * @template Credentials
 * @extends PluginModelModel<Credentials>
 */
export default class ChatPluginModel extends PluginModelModel{

    /**
     * This method should be overriden to notify users about an incoming call
     * @param {object} param0 
     * @param {string[]} param0.ids The user ids that should be notified about a call
     * @param {telep.chat.calling.CallStat} param0.call
     */
    async ringNotify({ids, call}){
        
    }

    /**
     * @readonly
     * @returns {ChatController}
     */
    get controllers(){
        return global.chatController
    }
}


global.ChatPluginModel = ChatPluginModel