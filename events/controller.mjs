/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * This module deals with aspects of the platform related to notifying clients
 */

import muser_common from "muser_common"
import ChatManagement from "../management/controller.mjs";




const controllers = Symbol()


/**
 * @extends FacultyPublicJSONRPC.EventChannel.Server<undefined,import("../public/event-client/remote/remote.mjs").default>
 */
export default class ChatEventsController extends FacultyPublicJSONRPC.EventChannel.Server {


    /**
     * 
     * @param {object} _controllers 
     * @param {ChatManagement} _controllers.management
     */
    constructor(_controllers) {
        super()

        this[controllers] = _controllers

    }

    /**
     * @param {object} param0
     * @param {undefined} param0.data
     * @param {import("system/comm/rpc/json-rpc.mjs").default} param0.client
     */
    async register({ data, client }) {
        const userid = (await muser_common.getUser(client)).id;

        // Now, get the groups the user belongs to, and sign him up for notifications
        // only from the active chats
        const groups = await this[controllers].management.getUserChats({ userid })

        const active = this.filterByActive(groups.map(x => x.id))

        return [
            userid,
            ...active
        ]

    }



}