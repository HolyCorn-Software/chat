/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty.
 * This module deals with the overall management of chats
 */

import muser_common from "muser_common"
import shortUUID from "short-uuid"



const collection = Symbol()

function modernuser() {
    return FacultyPlatform.get().connectionManager.overload.modernuser()
}


export default class ChatManagement {


    /**
     * 
     * @param {telep.chat.management.ChatDataCollection} coln 
     */
    constructor(coln) {
        this[collection] = coln

        this.events = new EventTarget()
    }

    /**
     * This method starts a chat between named parties
     * @param {telep.chat.management.ChatInit} init 
     * @returns {Promise<string>}
     */
    async createChat(init) {
        const { userid } = init;
        delete init.userid
        const id = shortUUID.generate()

        if (!(init.recipients?.length > 0)) {
            throw new Exception(`You need at least two (2) recipients to start a chat.`)
        }


        const recipients = Reflect.ownKeys(
            Object.fromEntries(
                [...init.recipients, userid].map(x => [x, true])
            )
        );
        await this[collection].insertOne(
            {
                id,
                ...init,
                // Let's have a unique list of recipients, that includes the sender
                recipients: recipients
            }
        );

        this.events.dispatchEvent(
            new CustomEvent(
                'new-chat',
                {
                    detail: { id }
                }
            )
        )

        return id;
    }

    /**
     * This method is used to end a chat
     * @param {object} data 
     * @param {string} data.id
     * @param {string} data.userid
     * @returns {Promise<void>}
     */
    async endChat(data) {

        // Now, let's be sure that the person ending this chat full rights
        await this.authenticateAction(
            {
                chat: data.id,
                userid: data.userid,
                request: {
                    end: true
                },
                throwError: true
            }
        )

        await this[collection].updateOne({ id: data.id }, { $set: { ended: Date.now(), modified: Date.now() } })

        // And, when we're done, let other components know
        faculty.connectionManager.events.emit(`${faculty.descriptor.name}-chat-end`, { id: data.id })

        // Also let the users know

        this.events.dispatchEvent(
            new CustomEvent(
                'chat-ended',
                {
                    detail: { id: data.id }
                }
            )
        )

    }


    /**
     * This method checks if a particular chat can be interacted with
     * @param {object} data 
     * @param {string} data.userid
     * @param {string} data.id
     * @returns {Promise<boolean>}
     */
    async chatActive(data) {
        const chat = await this.getChatInfoSecure({ id: data.id, userid: data.userid })
        return (!chat.disabled) && (!chat.ended)
    }

    /**
     * This method either activates, or deactivates a chat
     * @param {object} data 
     * @param {string} data.chat
     * @param {string} data.userid The id of the user performing this action
     * @param {boolean} data.state Should the chat be active, or deactivated.
     */
    async toggleChatState(data) {
        // Let's get information about the chat, in a way that authenticates the user
        const active = (await this.getChatInfoSecure({ id: data.chat, userid: data.userid })).disabled ?? false
        if (active == data.state ?? false) {
            // No need to run a database query, if the chat is already in the desired state
            return
        }
        // And now, let's activate, or deactivate the chat
        await this[collection].updateOne({ id: data.chat }, { $set: { disabled: !!!data.state, modified: Date.now() } })

        this.events.dispatchEvent(
            new CustomEvent(
                'chat-state-changed',
                {
                    detail: {
                        id: data.chat,
                        state: active
                    }
                }
            )
        )
    }

    /**
     * This method gets information about a chat, while making sure,
     * the user getting the information is allowed to do so
     * @param {object} data 
     * @param {string} data.id
     * @param {string} data.userid
     * @returns {Promise<telep.chat.management.Chat>}
     */
    async getChatInfoSecure(data) {
        const chatData = await this[collection].findOne({ id: data.id }, { projection: { _id: 0 } })
        if (!chatData) {
            throw new Exception(`The chat ${data.id}, was not found!`)
        }
        if (data.userid) {
            if (!await muser_common.whitelisted_permission_check(
                {
                    userid: data.userid,
                    intent: { freedom: 'use' },
                    permissions: ['permissions.telep.chat.supervise'],
                    throwError: false,
                    whitelist: chatData.recipients
                }
            )) {
                console.log(`chatData is `, chatData, `\nAnd userid is `, data.userid)
                throw new Exception(`Sorry, you're not even part of this chat (${data.id})`)
            }
        }

        return chatData
    }

    /**
     * This method returns all chats the user belongs to
     * @param {object} param0 
     * @param {string} param0.userid
     * @param {telep.chat.management.ChatType} param0.type If specified, only those types of chats will be searched
     * @returns {Promise<telep.chat.management.Chat[]>}
     */
    async getUserChats({ userid, type }) {
        return this[collection].find(
            {
                recipients: {
                    $elemMatch: {
                        $eq: userid
                    }
                },
                ...(typeof type !== 'undefined' ? { type } : {})
            },
            {
                projection: { _id: 0 }
            }
        ).toArray()
    }


    /**
     * This method is used to check if a user can perform a certain action on a chat
     * @param {object} data 
     * @param {string} data.chat
     * @param {string} data.userid
     * @param {boolean} data.throwError
     * @param {telep.chat.management.RuleCheck} data.request
     * @returns {Promise<boolean>}
     */
    async authenticateAction(data) {
        const chatData = await this.getChatInfoSecure({ id: data.chat, userid: data.userid })


        /**
         * This method recursively checks if a user is allowed to perform a rule, by a given request
         * @param {telep.chat.management.RuleCheck} request The rules to be checked
         * @param {telep.chat.management.Rules} rulelist The rules to serve as truth
         * @returns {Promise<boolean>}
         */

        const checkRule = async (req, rulelist) => {


            for (const key in rulelist) {
                if (rulelist[key]) {
                    if (req?.[key]) {
                        //Then the rule exists, and is being checked, and it is not a compound rule
                        if (req[key] === true) {
                            // Then the rule is not a compound rule
                            // It is a simple rule like {end: true}
                            if (!await checkUserByRule(data.userid, rulelist[key], [chatData.created?.userid], data.throwError)) {
                                return false
                            }
                        } else {
                            if (typeof req[key] === 'object') {
                                // A compound rule e.g { call:{audio: true} }
                                if (!await checkRule(req[key], rulelist[key])) {
                                    return false
                                }
                            }
                        }
                    }
                }//else, rule already passed
            }

            // Getting to this point means all checks have been passed
            return true

        }

        return await checkRule(data.request, chatData.rules)
    }

    /**
     * This method computes relevant data needed by a user, to identify a chat
     * @param {object} data 
     * @param {string} data.userid
     * @param {string} data.id
     * @returns {Promise<{label: string, icon: string}>}
     */
    async getChatViewData(data) {
        const chat = await this.getChatInfoSecure(data)
        let otherUser;
        return {
            // Use the name of the group chat if possible, or...
            label: chat.type === 'group' ? chat.label : (
                // Get the user name of the other user belonging to the chat
                otherUser = await (await faculty.connectionManager.overload.modernuser())
                    .profile.get_profile({
                        id: chat.recipients.filter(x => x !== data.userid)[0]
                    })
            ).label,
            icon: chat.type === 'group' ? chat.icon : otherUser.icon,
            ...chat
        }
    }


}

const faculty = FacultyPlatform.get()


/**
 * This method checks if a user qualifies for a rule
 * @param {string} userid 
 * @param {telep.chat.management.RuleWhitelist} rule 
 * @param {string[]} whitelist
 * @param {boolean} throwError
 * @returns {boolean}
 */
const checkUserByRule = async (userid, rule = ['any'], whitelist, throwError) => {
    for (const entry of rule) {
        if ((entry == 'any') || (userid === entry)) {
            return true
        }
    }

    if (
        !await muser_common.whitelisted_permission_check(
            {
                userid,
                intent: {
                    freedom: 'use',
                },
                whitelist,
                permissions: ['permissions.telep.chat.supervise'],
                throwError: false
            }
        )

    ) {
        if (throwError) {
            throw new Exception(`Sorry, you don't have the right to do this.`)
        } else {
            return true
        }
    }

    return false

}