import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import MessagingPayload = admin.messaging.MessagingPayload

admin.initializeApp()

type NotificationType = "news" | "message" | "invite" | "encyclopedia"

export const newsNotification = functions.firestore.document(`/default/{environment}/news/{newsId}`)
    .onCreate(async (snapshot, context) => {
        const environment = context.params.environment
        if(!environment) throw Error("No environment found")

        const news = snapshot.data()

        const message = notificationFactory(`News update`, news.title, "news", snapshot.id)

        return await admin.messaging().sendToTopic(environment, message)
    })


export const encyclopediaNotification = functions.firestore.document(`/default/{environment}/encyclopedia/{newsId}`)
    .onCreate(async (snapshot, context) => {
        const environment = context.params.environment
        if(!environment) throw Error("No environment found")

        const news = snapshot.data()

        const message = notificationFactory(`Encyclopedia update`, news.title, "encyclopedia", snapshot.id)

        return await admin.messaging()
            .sendToTopic(environment, message)
    })


export const inviteNotification = functions.firestore.document(`/default/{environment}/users/{userId}/invites/{groupId}`)
    .onCreate(async (snapshot, context) => {
        const environment = context.params.environment
        if(!environment) throw Error("No environment found")

        const userId: string = context.params.userId
        // const groupId: string = context.params.groupId

        const deviceId: string | null = await getDeviceIdFromUserId(userId, environment)

        if (!deviceId) return null

        const groupTitle = snapshot.data().title


        return await admin.messaging().sendToDevice(
            deviceId,
            notificationFactory("You have new invite", `New invite to group ${groupTitle}`, "invite", snapshot.id)
        )
    })

async function getDeviceIdFromUserId(userId: string, environment: string): Promise<string | null> {
    return (await admin.firestore()
        .collection(`/default/${environment}/deviceTokens`)
        .doc(userId)
        .get())
        .data()
        .value
}

export const messageNotification = functions.firestore.document(`/default/{environment}/groups/{groupId}/messages/{messageId}`)
    .onCreate(async (snapshot, context) => {
        const environment = context.params.environment
        if(!environment) throw Error("No environment found")

        const groupId: string = context.params.groupId

        const groupTitle: string = (await admin.firestore()
            .collection(`/default/${environment}/groups/`)
            .doc(groupId)
            .get())
            .data()
            .title


        const message = snapshot.data()

        const deviceIdPromises = (await  admin.firestore()
            .collection(`/default/${environment}/groups/${groupId}/notifications`)
            .get())
            .docs
            .map(docSnapshot => docSnapshot.id)
            .filter(userId => userId != message.owner) //don't send notif to sender
            .map(userId => getDeviceIdFromUserId(userId, environment))


        const pushMessage = notificationFactory(
            `${groupTitle}`,
            getMessageBody(message.senderName, message.text),
            "message",
            groupId
        )

        return Promise.all((await Promise.all(deviceIdPromises))
            .filter((it) => it)
            .map(deviceId => admin.messaging().sendToDevice(
                deviceId,
                pushMessage
            )))
    })

const THRESHOLD = 130
function getMessageBody(sender: string, text: string): string{
    let processedText: string
    if(text.length > THRESHOLD)
        processedText = text.substr(0,THRESHOLD).concat("…")
    else
        processedText = text

    return `${sender}: ${processedText}`
}


function notificationFactory(title: string, body: string, type: NotificationType, key: string): MessagingPayload {
    return {
        notification: {
            title,
            body,
            sound: "pda"
        },
        data: {
            type,
            key
        }
    }
}