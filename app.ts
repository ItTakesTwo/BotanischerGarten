/**
 * Created by hypfer on 06.06.17.
 */
//external dependencies
import TelegramBot = require("node-telegram-bot-api");
import * as express from "express";
import * as path from "path";
import * as session from "express-session";
import * as mongoSessionStore from "connect-mongo";
import * as sendSeekable from "send-seekable";
import * as bodyParser from "body-parser";
import * as compression from "compression";
import * as ipRangeCheck from "ip-range-check";
//Own stuff
import {Bot} from "./bot";
import {Emo} from "./modules/Emo";
import {Dice} from "./modules/Dice";
import {Fakt} from "./modules/Fakt";
import {Hashes} from "./modules/Hashes";
import {MongoRepository} from "./lib/Repositories/MongoRepository";
import {Bullshit} from "./modules/Bullshit";
import {Dawa} from "./modules/Dawa";
import {Stoll} from "./modules/Stoll";
import {Unicode} from "./modules/Unicode";

//This makes IRepository useless
const MongoStore = mongoSessionStore(session);

const config = require("./config.json");

const _Repository = new MongoRepository(config, function () {
    const _Bot = new Bot(config, _Repository);
    const _App = express();

    const sessionStore = new MongoStore({
        db: _Repository.DB,
        collection: 'sessions'
    });

    _App.use(function isTelegramIp(req,res,next){
        (req as any).isTelegramIP = ipRangeCheck(req.headers['x-forwarded-for'] || req.connection.remoteAddress, [
            "149.154.160.0/20",
            "149.154.164.0/22",
            "91.108.4.0/22",
            "91.108.56.0/22",
            "91.108.8.0/22",
            "2001:67c:4e8::/48"
        ]);
        next();
    });
    _App.use(compression());
    _App.use(require('express-session')({
        secret: config.sessionSecret,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 3650 // 1 week
        },
        store: sessionStore,
        resave: true,
        saveUninitialized: false
    }));
    _App.use(sendSeekable);
    _App.use(bodyParser.json());
    _App.use(bodyParser.urlencoded({extended: true}));
    _App.use('/s', express.static(path.join(_Bot.WebAssetPath + '/static')));
    _App.set('view engine', 'hbs');
    _App.set('views', path.join(_Bot.WebAssetPath + '/templates'));

    const Modules = [
        new Emo(config, _Bot, _App),
        new Dice(config, _Bot, _App),
        new Fakt(config, _Bot, _App),
        new Bullshit(config, _Bot, _App),
        new Dawa(config, _Bot, _App),
        new Stoll(config, _Bot, _App),
        new Unicode(config, _Bot, _App),

        new Hashes(config, _Bot, _App)
    ];

    _App.use(function (req, res, next) {
        res.status(404).sendFile(path.join(_Bot.WebAssetPath +  '/static/404.html'));
    });

    _App.listen(3000);
});




