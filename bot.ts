import TelegramBot = require("node-telegram-bot-api");
import {OutgoingMessage} from "./lib/DataObjects/Messages/OutgoingMessages/OutgoingMessage";
import {User} from "./lib/DataObjects/User";
import {UserService} from "./lib/Services/UserService";
import {IncomingMessage} from "./lib/DataObjects/Messages/IncomingMessage";
import {CommandManager} from "./lib/CommandManager";
import * as Chain from "chaining-tool";
import * as async from "async";
import {InlineQueryResult} from "./lib/DataObjects/InlineQueryResults/InlineQueryResult";
import {OutgoingTextMessage} from "./lib/DataObjects/Messages/OutgoingMessages/OutgoingTextMessage";
import {OutgoingPhotoMessage} from "./lib/DataObjects/Messages/OutgoingMessages/OutgoingPhotoMessage";
import {OutgoingVideoMessage} from "./lib/DataObjects/Messages/OutgoingMessages/OutgoingVideoMessage";
import {OutgoingVideoMessageMessage} from "./lib/DataObjects/Messages/OutgoingMessages/OutgoingVideoMessageMessage";
import {OutgoingAudioMessage} from "./lib/DataObjects/Messages/OutgoingMessages/OutgoingAudioMessage";
import {OutgoingDocumentMessage} from "./lib/DataObjects/Messages/OutgoingMessages/OutgoingDocumentMessage";
import {OutgoingStickerMessage} from "./lib/DataObjects/Messages/OutgoingMessages/OutgoingStickerMessage";
import {OutgoingVoiceMessage} from "./lib/DataObjects/Messages/OutgoingMessages/OutgoingVoiceMessage";
import {OutgoingLocationMessage} from "./lib/DataObjects/Messages/OutgoingMessages/OutgoingLocationMessage";
import {OutgoingVenueMessage} from "./lib/DataObjects/Messages/OutgoingMessages/OutgoingVenueMessage";
import {OutgoingContactMessage} from "./lib/DataObjects/Messages/OutgoingMessages/OutgoingContactMessage";
import {MongoRepository} from "./lib/Repositories/MongoRepository";
import {Group} from "./lib/DataObjects/Group";
import {GroupService} from "./lib/Services/GroupService";
import * as path from "path";
/**
 * Created by hypfer on 06.06.17.
 */
export class Bot {
    //Ein Singleton!
    private static instance: Bot;
    TgBot: TelegramBot;
    Repository: MongoRepository;
    UserService: UserService;
    GroupService: GroupService;
    CommandManager: CommandManager;
    MessageChain: any;
    InlineChain: any;
    private Config: any;
    About : {
        id : number,
        first_name : string,
        last_name : string,
        username : string
    };
    WebAssetPath : any;


    constructor(config: any, repository: MongoRepository) {
        const self = this;

        if (Bot.instance) {
            return Bot.instance;
        }
        this.Config = config;
        this.TgBot = new TelegramBot(config.token, {polling: true});
        this.Repository = repository;
        this.UserService = new UserService(this.Repository);
        this.GroupService = new GroupService(this.Repository);
        this.CommandManager = new CommandManager();
        this.MessageChain = new Chain();
        this.InlineChain = new Chain();
        this.About = {
            id : -1,
            first_name : "",
            last_name: "",
            username: ""
        };
        this.WebAssetPath = path.join(__dirname + '/webAssets/');

        this.TgBot.getMe().then(function(me){
            self.About.id = me.id;
            self.About.first_name = me.first_name;
            self.About.last_name = me.last_name;
            self.About.username = me.username;
        });

        this.TgBot.on('message', function (msg) {
            if (self.Config.debug &&
                self.Config.debug.incoming &&
                self.Config.debug.incoming.message) {
                console.dir(msg);
            }
            self.buildIncomingMessage(msg, function (Message: IncomingMessage) {
                if (Message.From.ID === -1 && msg.chat.type === "private") {
                    if (msg.text === "/start") {
                        self.UserService.SaveUser(
                            new User(msg.from.id, msg.from.first_name, [], msg.from.username),
                            function () {
                                self.sendReply(new OutgoingTextMessage("You are now opted in!"), msg.chat.id);
                            }
                        )
                    }
                } else if (Message.From.ID !== -1 && msg.chat.type === "private" && msg.text === "/stop") {
                    self.UserService.DeleteUser(
                        Message.From,
                        function () {
                            self.GroupService.GetGroupsWithUser(Message.From.ID, function (groups) {
                                const deleteFunctions = [];
                                groups.forEach(function (group: Group) {
                                    deleteFunctions.push(function (callback) {
                                        group.removeMember(Message.From.ID);
                                        self.GroupService.SaveGroup(group, function () {
                                            callback();
                                        })
                                    })
                                });


                                async.waterfall(deleteFunctions, function () {
                                    self.sendReply(
                                        new OutgoingTextMessage("Your Account has been deleted."),
                                        msg.chat.id
                                    );
                                });
                            });

                        }
                    )
                } else {
                    if (Message.From.hasRole("user")) {
                        self.MessageChain.start(Message,
                            function (context) {
                                //success
                            },
                            function (context) {
                                //interrupted
                            });
                    }
                }
            });
        });

        this.TgBot.on('inline_query', function (msg) {
            if (self.Config.debug &&
                self.Config.debug.incoming &&
                self.Config.debug.incoming.inline) {
                console.dir(msg);
            }

            self.buildIncomingMessage(msg, function (Message: IncomingMessage) {
                if (Message.From.hasRole("user")) {
                    self.InlineChain.start(Message,
                        function (context) {
                            //success
                        },
                        function (context) {
                            //interrupted
                        });
                }
            });
        });

        Bot.instance = this;
    }

    sendReply(message: OutgoingMessage, chatId: number, callback?: Function) {
        const self = this;

        callback = callback ? callback : function () {
        };

        if (message instanceof OutgoingTextMessage) {
            if (message.Text.length <= 4096) {
                this.TgBot.sendMessage(chatId, message.Text).then(function () {
                    callback();
                });
            } else {
                const splitMessage = new OutgoingTextMessage(message.Text.substr(4096));
                this.TgBot.sendMessage(chatId, message.Text.substr(0, 4096)).then(function () {
                    self.sendReply(splitMessage, chatId, callback);
                });
            }
        } else if (message instanceof OutgoingPhotoMessage) {
            this.TgBot.sendPhoto(chatId, message.FileId).catch((error) => {
                console.error("FileID is invalid. Sending raw file");
                self.Repository.GetData(message.DataStreamInternalID, function (data) {
                    message.DataStreamHex = data;
                    self.TgBot.sendPhoto(chatId, Buffer.from(message.DataStreamHex, "hex")).then(function (msg) {
                        callback(msg);
                    }).then(function () {
                        callback();
                    });
                });
            });
        } else if (message instanceof OutgoingVideoMessage) {
            this.TgBot.sendVideo(chatId, message.FileId).catch((error) => {
                console.error("FileID is invalid. Sending raw file");
                self.Repository.GetData(message.DataStreamInternalID, function (data) {
                    message.DataStreamHex = data;
                    self.TgBot.sendVideo(chatId, Buffer.from(message.DataStreamHex, "hex")).then(function (msg) {
                        callback(msg);
                    }).then(function () {
                        callback();
                    });
                });
            });
        } else if (message instanceof OutgoingVideoMessageMessage) {
            this.TgBot.sendVideoNote(chatId, message.FileId).catch((error) => {
                console.error("FileID is invalid. Sending raw file");
                self.Repository.GetData(message.DataStreamInternalID, function (data) {
                    message.DataStreamHex = data;
                    self.TgBot.sendVideoNote(chatId, Buffer.from(message.DataStreamHex, "hex")).then(function (msg) {
                        callback(msg);
                    }).then(function () {
                        callback();
                    });
                });
            });
        } else if (message instanceof OutgoingAudioMessage) {
            this.TgBot.sendAudio(chatId, message.FileId).catch((error) => {
                console.error("FileID is invalid. Sending raw file");
                self.Repository.GetData(message.DataStreamInternalID, function (data) {
                    message.DataStreamHex = data;
                    self.TgBot.sendAudio(chatId, Buffer.from(message.DataStreamHex, "hex"),
                        {
                            "title": message.Title,
                            "performer": message.Performer
                        }).then(function (msg) {
                        callback(msg);
                    }).then(function () {
                        callback();
                    });
                });
            });
        } else if (message instanceof OutgoingDocumentMessage) {
            this.TgBot.sendDocument(chatId, message.FileId).catch((error) => {
                console.error("FileID is invalid. Sending raw file");
                self.Repository.GetData(message.DataStreamInternalID, function (data) {
                    message.DataStreamHex = data;
                    self.TgBot.sendDocument(chatId, Buffer.from(message.DataStreamHex, "hex")
                    ).then(function (msg) {
                        callback(msg);
                    }).then(function () {
                        callback();
                    });
                });
            });
        } else if (message instanceof OutgoingStickerMessage) {
            this.TgBot.sendSticker(chatId, message.FileId).catch((error) => {
                console.error("FileID is invalid. Sending raw file");
                self.Repository.GetData(message.DataStreamInternalID, function (data) {
                    message.DataStreamHex = data;
                    self.TgBot.sendSticker(chatId, Buffer.from(message.DataStreamHex, "hex")
                    ).then(function (msg) {
                        callback(msg);
                    }).then(function () {
                        callback();
                    });
                });
            });
        } else if (message instanceof OutgoingVoiceMessage) {
            this.TgBot.sendVoice(chatId, message.FileId).catch((error) => {
                console.error("FileID is invalid. Sending raw file");
                self.Repository.GetData(message.DataStreamInternalID, function (data) {
                    message.DataStreamHex = data;
                    self.TgBot.sendVoice(chatId, Buffer.from(message.DataStreamHex, "hex")
                    ).then(function (msg) {
                        callback(msg);
                    }).then(function () {
                        callback();
                    });
                });
            });
        } else if (message instanceof OutgoingLocationMessage) {
            if (message instanceof OutgoingVenueMessage) {
                this.TgBot.sendVenue(chatId, message.Latitude, message.Longitude,
                    message.Title, message.Address).then(function () {
                    callback();
                });
            } else {
                this.TgBot.sendLocation(chatId, message.Latitude, message.Longitude).then(function () {
                    callback();
                });
            }
        } else if (message instanceof OutgoingContactMessage) {
            this.TgBot.sendContact(chatId, message.Phone_number, message.First_name).then(function () {
                callback();
            });
        }
    }

    answerInlineQuery(id: string, results: Array<InlineQueryResult>, options: any) {
        if (results.length > 50) {
            results = results.slice(0, 50);
        }
        this.TgBot.answerInlineQuery(id, results, options);
    }

    private buildIncomingMessage(msg: any, callback: Function) {
        const self = this;
        let user, group;

        if (msg.from) {
            user = new User(msg.from.id, msg.from.first_name, [], msg.from.username);
        } else {
            user = new User(-1, "Unknown", []);
        }

        this.UserService.FindUser(user, function (user) {
            if (user) {
                if (msg.chat) {
                    group = new Group(msg.chat.id, msg.chat.type, msg.chat.title);

                    self.GroupService.FindGroup(group, function (group) {
                        let changed = false;

                        if (!group.isMember(user.ID)) {
                            group.addMember(user.ID);
                            changed = true;
                        }

                        //Since I'm only allowed to save people who opt-in to this bot
                        //i cannot just push every ID that joins the group
                        //
                        //To avoid the callback hell it will be required for new members which are opted-in
                        //to send a message to the group they want to be part of
                        //This way the user object is already in memory :-)
                        /*
                         if(msg.new_chat_members && msg.new_chat_members.length > 0) {
                         msg.new_chat_members.forEach(function(member){
                         group.addMember(member.id);
                         });
                         changed = true;
                         }
                         if(msg.new_chat_member) {
                         group.addMember(msg.new_chat_member.id);
                         changed = true;
                         } */
                        if (msg.left_chat_member) {
                            group.removeMember(msg.left_chat_member.id);
                            changed = true;
                        }

                        if (changed === true) {
                            self.GroupService.SaveGroup(group, function () {
                                callback(new IncomingMessage(user, msg, group));
                            })
                        } else {
                            callback(new IncomingMessage(user, msg, group));
                        }
                    });
                } else {
                    callback(new IncomingMessage(user, msg));
                }
            } else {
                callback(new IncomingMessage(new User(-1, "Unknown", []), msg));
            }

        });
    }


}