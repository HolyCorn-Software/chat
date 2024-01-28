/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This module provides remote methods to backend components of the faculty
 */

import GlobalCallingManager from "/$/chat/calling/static/call-manager/global-calling-manager.mjs";


export default class ChatClientRemoteMethods {

    constructor() {
        this.calling = GlobalCallingManager.get().remote
    }

}
