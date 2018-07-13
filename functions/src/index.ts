import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import MessagingPayload = admin.messaging.MessagingPayload

admin.initializeApp()

const environment = "stalker2018"
// const TOPIC_NEWS = "news"

export const stalkerpediaNotification = functions.firestore.document(`/default/${environment}/news/{newsId}`)
    .onCreate(async (snapshot, context) => {
        const news = snapshot.data()

        const message = notificationFactory(`News update`, news.title)

        return await admin.messaging().sendToTopic(environment, message)
    })


export const newsNotification = functions.firestore.document(`/default/${environment}/stalkerpedia/{newsId}`)
    .onCreate(async (snapshot, context) => {
        const news = snapshot.data()

        const message = notificationFactory(`Stalkerpedia update`, news.title)

        return await admin.messaging()
            .sendToTopic(environment, message)
    })


export const inviteNotification = functions.firestore.document(`/default/${environment}/users/{userId}/invites/{groupId}`)
    .onCreate(async (snapshot, context) => {
        const userId: string = context.params.userId
        // const groupId: string = context.params.groupId

        const deviceId: string | null = await getDeviceIdFromUserId(userId)

        if (!deviceId) return null

        const groupTitle = snapshot.data().title


        return await admin.messaging().sendToDevice(
            deviceId,
            notificationFactory("You have new invite", `New invite to group ${groupTitle}`)
        )
    })

async function getDeviceIdFromUserId(userId: string): Promise<string | null> {
    return (await admin.firestore()
        .collection(`/default/${environment}/deviceTokens`)
        .doc(userId)
        .get())
        .data()
        .value
}

export const messageNotification = functions.firestore.document(`/default/${environment}/groups/{groupId}/messages/{messageId}`)
    .onCreate(async (snapshot, context) => {
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
            .filter(userId => userId != message.senderId) //don't send notif to sender
            .map(userId => getDeviceIdFromUserId(userId))


        const pushMessage = notificationFactory(
            `${groupTitle}`,
            getMessageBody(message.sender, message.text)
        )

        return Promise.all((await Promise.all(deviceIdPromises))
            .filter((it) => it)
            .map(deviceId => admin.messaging().sendToDevice(
                deviceId,
                pushMessage
            )))
    })

const TRESHOLD = 130
function getMessageBody(sender: string, text: string): string{
    let processedText: string
    if(text.length > TRESHOLD)
        processedText = text.substr(0,TRESHOLD).concat("…")
    else
        processedText = text

    return `${sender}: ${processedText}`
}


function notificationFactory(title: string, body: string): MessagingPayload {
    return {
        notification: {
            title,
            body,
            sound: "pda"
        }
    }
}