/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty.
 * This module deals with the overall management of chats
 */

import muser_common from "muser_common"
import shortUUID from "short-uuid"
import nodeUtil from 'node:util'



const collections = Symbol()


export default class ChatManagement {


    /**
     * @param {telep.chat.management.ChatManagementCollections} _collections
     */
    constructor(_collections) {
        this[collections] = _collections
        this.events = new EventTarget()
    }

    /**
     * This method starts a chat between named parties
     * @param {telep.chat.management.ChatInit} init 
     * @returns {Promise<string>}
     */
    async createChat(init) {
        const { userid } = init;
        console.log(`init.type `, init.type)
        soulUtils.checkArgs(init, {
            type: '"private"|"roled"|"group"',
        }, 'init')
        delete init.userid
        const id = shortUUID.generate()

        if (!(init.recipients?.length > 0)) { // A roled chat requires just one user
            throw new Exception(`You need at least two (2) recipients to start a chat.`)
        }


        const recipients = Reflect.ownKeys(
            Object.fromEntries(
                [...init.recipients, userid].map(x => [x, true])
            )
        );

        if (init.role) {
            soulUtils.checkArgs(init.role, 'string', 'init.role', undefined, ['definite'])

            /** @type {telep.chat.management.Chat['role']} */
            const fullRole = {
                data: {
                    name: init.role,
                    label: (await this[collections].role.data.findOne({ name: init.role })).label,
                },
                member: undefined
            }

            init.role = fullRole
        }

        await this[collections].data.insertOne(
            {
                id,
                ...(soulUtils.pickOnlyDefined(init, ['type', 'disabled', 'rules', 'role'])),
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

        await this[collections].data.updateOne({ id: data.id }, { $set: { ended: Date.now(), modified: Date.now() } })

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
        await this[collections].data.updateOne({ id: data.chat }, { $set: { disabled: !!!data.state, modified: Date.now() } })

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
        const chatData = await this[collections].data.findOne({ id: data.id }, { projection: { _id: 0 } })
        if (!chatData) {
            throw new Exception(`The chat ${data.id}, was not found!`)
        }
        if (data.userid) {

            const whitelist = [...chatData.recipients]

            if (chatData.type == 'roled' && await this.isMemberOfRole({ role: chatData.role.data.name, userid: data.userid })) {
                // If this chat is a roled chat (e.g customer service chat), allow a user who is a member of that role to view
                whitelist.push(data.userid)
            }

            if (!await muser_common.whitelisted_permission_check(
                {
                    userid: data.userid,
                    intent: { freedom: 'use' },
                    permissions: ['permissions.telep.chat.supervise'],
                    throwError: false,
                    whitelist
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
        const isTyped = (typeof type !== 'undefined') && (type != null)
        /** @type {Parameters<this[collections]['data']['find']>['0']} */
        const query = {
            ...(isTyped ? { type } : { type: { $not: { $eq: 'roled' } } }),
            $or: [
                {
                    recipients: {
                        $elemMatch: {
                            $eq: userid
                        }
                    },
                },

            ]
        }

        if (type == 'roled') {
            // If we're dealing with roled chats, we don't only have to return the chats where the user is part.
            // We also need chats that the user can be part of.
            const userRoles = (await this[collections].role.members.find({ userid }).toArray()).map(x => x.role)
            const rolePlayExclude = {
                recipients: { $elemMatch: { $eq: userid } },
                'role.data.name': { $in: userRoles }
            }
            query.$or.push({
                'role.data.name': { $in: userRoles, },
                'role.member': { $exists: false },

            });
            query.$or.forEach(x => {
                // Exclude the roled chats, where the calling user is a part of, if the chat is that of a role he already plays
                x.$nor = [rolePlayExclude]
            })
        }


        const items = (await this[collections].data.find(
            query,
            {
                projection: { _id: 0 }
            }
        ).toArray());

        const profiles = await (await faculty.connectionManager.overload.modernuser()).profile.getProfiles(items.map(x => x.recipients).flat(2))


        return items.map(item => {
            if (item.type == 'group') return item;
            let otherUser = item.recipients.filter(x => x !== userid)[0]
            return ChatManagement.getChatViewData0({ chat: item, userid, otherUser: profiles.find(x => x.id == otherUser) })
        })
    }

    /**
     * This method adds a user to a chat
     * @param {object} param0 
     * @param {string} param0.userid
     * @param {string} param0.id
     */
    async addUserToChat({ userid, id }) {
        if (!userid) {
            throw new Exception(`Please, pass a string for 'userid'.`)
        }

        const chatData = await this.getChatInfoSecure({ id, userid });
        if (chatData.recipients.includes(userid)) return;

        if ((chatData.recipients.length + 1) > (chatData.maxRecipients ?? Infinity)) {
            throw new Exception(`The maximum number of members of this chat, has been reached.`)
        }

        let isRoledUser = chatData.type == 'roled' && !chatData.role.member && (await this.isMemberOfRole({ role: chatData.role.data.name, userid }))


        await this[collections].data.updateOne({ id }, { $push: { recipients: userid }, $set: { 'role.member': isRoledUser ? userid : undefined } });
    }

    /**
     * This method is called when a user wants to exit a chat
     * @param {object} param0 
     * @param {string} param0.userid
     * @param {string} param0.id
     */
    async exit({ userid, id }) {

        const chat = await this.getChatInfoSecure({ userid, id })

        if (chat.type == 'private') throw new Exception(`You can't exit a private chat.`); // No one can exit a private chat

        if (chat.type == 'roled' && chat.role?.member != userid) {
            throw new Exception(`Only the other person can exit this chat.`); // In a roled chat, only the role player can exit
        }
        await this[collections].data.updateOne({ id }, { $unset: { [chat.role?.member == userid ? 'role.member' : undefined]: true }, $pull: { recipients: userid } })
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
     */
    async getChatViewData(data) {
        const chat = await this.getChatInfoSecure(data)

        let otherUser = await (async () => {
            if ((chat.type == 'roled' && data.userid != chat.role.member) || !data.userid) {
                return {}
            }
            return await (await faculty.connectionManager.overload.modernuser()).profile.get_profile({
                id: chat.recipients.filter(x => x !== data.userid)[0]
            })

        })();



        return ChatManagement.getChatViewData0({ chat, userid: data.userid, otherUser })
    }

    static getChatViewData0({ chat, userid, otherUser }) {


        /** This tells us if the calling user is the 'client' of the roled chat, and not the agent. */
        const isRoleClient = chat.type == 'roled' && chat.recipients.includes(userid)

        return {
            ...chat,
            // Use the name of the group chat if possible, or...
            label: chat.type == 'group' ? chat.label : (
                // Get the user name of the other user belonging to the chat
                (() => {
                    if (isRoleClient) {
                        return chat.role.data.label
                    }
                    return otherUser?.label
                })()
            ),
            icon: (chat.type === 'group') || isRoleClient ? chat.icon : otherUser?.icon,
        }
    }

    /**
     * This method creates a new chat role, so that chats can be started with the given role
     * @param {object} param0 
     * @param {telep.chat.management.ChatRole['name']} param0.name
     * @param {telep.chat.management.ChatRole['label']} param0.label
     */
    async createChatRole({ userid, name, label }) {

        // Normally, this method should not be called over the public web, but if it happens, in the worst case scenario, let's check for the highest
        // permissions, as a security measure.
        await muser_common.whitelisted_permission_check({ userid, permissions: ['permissions.modernuser.superuser'] })

        await this[collections].role.data.updateOne({ name }, { $set: { label }, $setOnInsert: { created: Date.now() } }, { upsert: true })

    }

    /**
     * This method adds a user to a role
     * @param {object} param0 
     * @param {string} param0.member
     * @param {telep.chat.management.ChatRole['name']} param0.role
     */
    async addUserToRole({ userid, member, role }) {
        // Normally, this method should not be called over the public web, but if it happens, in the worst case scenario, let's check for the highest
        // permissions, as a security measure.
        await muser_common.whitelisted_permission_check({ userid, permissions: ['permissions.modernuser.superuser'] })

        await this[collections].role.members.updateOne({ userid: member, role }, { $set: { role, userid: member } }, { upsert: true })
    }

    /**
     * This method removes a user from a role
     * @param {object} param0 
     * @param {string} param0.member
     * @param {telep.chat.management.ChatRole['name']} param0.role
     */
    async removeUserFromRole({ userid, member, role }) {
        // Normally, this method should not be called over the public web, but if it happens, in the worst case scenario, let's check for the highest
        // permissions, as a security measure.
        await muser_common.whitelisted_permission_check({ userid, permissions: ['permissions.modernuser.superuser'] })

        await this[collections].role.members.deleteOne({ userid: member, role })
    }

    /**
     * This method gets the users that make up a chat role
     * @param {object} param0 
     * @param {telep.chat.management.ChatRole['name']} param0.role
     */
    async * getRoleMembers({ role }) {
        for await (const item of await this[collections].role.members.find({ role })) {
            delete item._id
            delete item.role
            item.$profile = await (await FacultyPlatform.get().connectionManager.overload.modernuser()).profile.get_profile({ id: item.userid })
            delete item.$profile.meta
            yield item
        }
    }

    /**
     * This method checks to see if the given user is a member of a role
     * @param {object} param0 
     * @param {telep.chat.management.ChatRole['name']} param0.role
     * @param {string} param0.userid
     */
    async isMemberOfRole({ role, userid }) {
        return (await this[collections].role.members.countDocuments({ role, userid })) > 0
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