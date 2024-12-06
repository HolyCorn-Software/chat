/**
 * Copyright 2024 HolyCorn Software
 * The Faculty of Chat
 * This module contains type definitions that deal with the chat plugin system
 */

import _ChatPluginModel from './model.mjs'



declare global {
    const ChatPluginModel = _ChatPluginModel

    namespace faculty.plugin{
        interface plugins{
            calling: {
                
            }
        }
    }
}


