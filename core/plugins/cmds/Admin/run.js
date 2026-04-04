import vm from 'vm';

export const config = {
  name: "run",
  alias: ["eval", "execute"],
  role: 3,
  info: "Chạy code JavaScript",
  guide: "run <code>",
  cd: 2,
  prefix: true
};

export async function call(context) {
  const { api, event, threadID, messageID, args, senderID, send, reply, react, unsend, edit } = context;
  
  if (args.length === 0) {
    return reply("Vui lòng nhập code cần chạy!");
    return;
  }
  
  const code = args.join(" ");
  
  try {
    const sandbox = {
      api: api,
      event: event,
      threadID: threadID,
      messageID: messageID,
      senderID: senderID,
      args: args,
      send: send,
      reply: reply,
      react: react,
      unsend: unsend,
      edit: edit,
      services: global.services,
      global: global,
      console: console,
      process: process,
      setTimeout: setTimeout,
      setInterval: setInterval,
    };
    
    sandbox.context = sandbox;
    
    vm.createContext(sandbox);
    
    let result = await vm.runInContext(code, sandbox, {
      timeout: 10000,
      displayErrors: true
    });
    
    if (result === undefined) return;
    
    if (typeof result !== 'string') {
      try {
        result = JSON.stringify(result, null, 2);
      } catch (e) {
        result = String(result);
      }
    }
    
    await reply(result);
    
  } catch (error) {
    if (error) return console.error(error);
    return reply(`⚠️ Lỗi:\n${error.message}`);
  }
}