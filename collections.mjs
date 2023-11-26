/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This module makes it easier to access collections necessary for the faculty
 */

import { CollectionProxy } from "../../system/database/collection-proxy.js";


/**
 * @type {telep.chat.management.Collections}
 */
const collections = new CollectionProxy(
    {
        chats: 'chats',
        messaging: {
            messages: 'messages'
        }
    }
)

export default collections