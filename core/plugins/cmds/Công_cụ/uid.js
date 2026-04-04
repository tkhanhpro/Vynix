export const config = {
	name: "uid",
    alias: ["uid"],
    role: 0,
    info: "Lấy ID người dùng với contact",
	guide: "[reply/link]",
    cd: 2,
    prefix: false
  };

export async function call (context) {
    const { api, args, type, threadID, senderID, messageReply, mentions, contact } = context;
    if (type == "message_reply") { 
    var uid = messageReply.senderID; 
    return api.shareContact(`${uid}`, uid, threadID)
    };
    if (!args[0]) {
        return api.shareContact(`${senderID}`, senderID, threadID);
    } else {
	if (args[0].includes("facebook.com/") || args[0].includes("fb.com/")) {
    const res_ID = await api.getUID(args[0]);  
    return api.shareContact(`${res_ID}`, res_ID, threadID) 
    } else {
		for (var i = 0; i < Object.keys(mentions).length; i++) {
            var id = Object.keys(mentions)[i];
            return api.shareContact(`${id}`, id, threadID);
        }
		return;
        }
    }
}