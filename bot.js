const fs = require('fs')
const path = require('path')

const tdDirectory = path.resolve(__dirname, 'data')

const { Client } = require('tdl')
const { TDLib } = require('tdl-tdlib-addon')

let tdLibFile = process.platform === 'win32' ? 'tdjson.dll' : 'libtdjson.so'
if (process.platform === 'darwin') tdLibFile = 'libtdjson.dylib'

class Api {
  constructor () {
    if (fs.existsSync(`${__dirname}/data/${tdLibFile}`)) {
      this.client = new Client(new TDLib(`${__dirname}/data/${tdLibFile}`), {
        apiId: process.env.TELEGRAM_API_ID,
        apiHash: process.env.TELEGRAM_API_HASH,
        databaseDirectory: `${tdDirectory}/db`,
        filesDirectory: tdDirectory,
        verbosityLevel: 2,
        tdlibParameters: {
          use_secret_chats: true
        }
      })
    }
  }

  sendMethod (method, parm) {
    return new Promise((resolve, reject) => {
      this.client.invoke(Object.assign({ _: method }, parm)).then(resolve).catch((error) => {
        console.error('tdlib error:', error)
        reject(error)
      })
    })
  }
}

const tgApi = new Api()

;(async () => {
  await tgApi.client.connectAndLogin(() => ({
    type: 'bot',
    getToken: retry => retry
      ? Promise.reject('Token is not valid')
      : Promise.resolve(process.env.BOT_TOKEN)
  }))

  console.log(await tgApi.sendMethod('getMe'))
})()

tgApi.client.on('update', async (update) => {
  console.log(update)

  if (update.message && update.message.chat_id) {
    const chat = await tgApi.sendMethod('getChat', {
      chat_id: update.message.chat_id
    }).catch(console.error)

    if (chat.type._ === 'chatTypeSupergroup' && chat.type.is_channel) {
      let membersCount = 0

      do {
        const supergroupMembers = await tgApi.sendMethod('getSupergroupMembers', {
          supergroup_id: chat.type.supergroup_id,
          limit: 200
        }).catch(console.error)

        membersCount = supergroupMembers.members.length

        supergroupMembers.members.forEach(member => {
          tgApi.sendMethod('banChatMember', {
            chat_id: update.message.chat_id,
            member_id: {
              _: 'messageSenderUser',
              user_id: member.member_id.user_id
            }
          }).catch(console.error)
        })
      } while (membersCount >= 60)
    }
  }
})

tgApi.client.on('error', console.error)

tgApi.client.setLogFatalErrorCallback(errorMessage => {
  console.error('Fatal error:', errorMessage)
})
