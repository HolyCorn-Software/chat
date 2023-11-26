/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty
 * This module provides remote methods to backend components of the faculty
 */

import ChatCallingClientRemoteMethods from "./calling.mjs";


export default class ChatClientRemoteMethods {

    constructor() {
        this.calling = new ChatCallingClientRemoteMethods()
    }

}
