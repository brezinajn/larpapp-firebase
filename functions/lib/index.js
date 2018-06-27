"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const environment = "test";
const TOPIC_NEWS = "news";
exports.stalkerpediaNotification = functions.firestore.document(`/default/${environment}/news/{newsId}`)
    .onCreate((snapshot, context) => __awaiter(this, void 0, void 0, function* () {
    const news = snapshot.data();
    const message = notificationFactory(`News update`, news.title);
    return yield admin.messaging().sendToTopic(TOPIC_NEWS, message);
}));
exports.newsNotification = functions.firestore.document(`/default/${environment}/stalkerpedia/{newsId}`)
    .onCreate((snapshot, context) => __awaiter(this, void 0, void 0, function* () {
    const news = snapshot.data();
    const message = notificationFactory(`Stalkerpedia update`, news.title);
    return yield admin.messaging()
        .sendToTopic(TOPIC_NEWS, message);
}));
exports.inviteNotification = functions.firestore.document(`/default/${environment}/users/{userId}/invites/{groupId}`)
    .onCreate((snapshot, context) => __awaiter(this, void 0, void 0, function* () {
    const userId = context.params.userId;
    // const groupId: string = context.params.groupId
    const deviceId = yield getDeviceIdFromUserId(userId);
    if (!deviceId)
        return null;
    const groupTitle = snapshot.data().title;
    return yield admin.messaging().sendToDevice(deviceId, notificationFactory("You have new invite", `New invite to group ${groupTitle}`));
}));
function getDeviceIdFromUserId(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield admin.firestore()
            .collection(`/default/${environment}/deviceTokens`)
            .doc(userId)
            .get())
            .data()
            .value;
    });
}
exports.messageNotification = functions.firestore.document(`/default/${environment}/groups/{groupId}/messages/{messageId}`)
    .onCreate((snapshot, context) => __awaiter(this, void 0, void 0, function* () {
    const groupId = context.params.groupId;
    const groupTitle = (yield admin.firestore()
        .collection(`/default/${environment}/groups/`)
        .doc(groupId)
        .get())
        .data()
        .title;
    const deviceIdPromises = (yield admin.firestore()
        .collection(`/default/${environment}/groups/${groupId}/notifications`)
        .get())
        .docs
        .map(docSnapshot => docSnapshot.id)
        .map(userId => getDeviceIdFromUserId(userId));
    const message = snapshot.data();
    const pushMessage = notificationFactory(`${groupTitle}`, `${message.sender}: ${message.text}`.substr(0, 30).concat("…"));
    return Promise.all((yield Promise.all(deviceIdPromises))
        .filter((it) => it)
        .map(deviceId => admin.messaging().sendToDevice(deviceId, pushMessage)));
}));
function notificationFactory(title, body) {
    return {
        notification: {
            title,
            body
        }
    };
}
//# sourceMappingURL=index.js.map