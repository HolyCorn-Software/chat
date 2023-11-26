/**
 * Copyright 2023 HolyCorn Software
 * The Tele-Epilepsy Project
 * The Chat Faculty 
 * This module allows us to make use of the methods related to messaging
 */

import muser_common from "muser_common";
import MessagingController from "../controller.mjs";



export default class MessagingPublicMethods extends muser_common.UseridAuthProxy.createClass(MessagingController.prototype) { }